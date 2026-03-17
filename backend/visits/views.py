import json
import logging

from django.conf import settings as django_settings
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from farmers.models import Farm, Farmer
from schedules.models import Schedule

from .models import ActivityTypeConfig, Product, Visit, VisitProduct
from .serializers import (
    ProductCreateSerializer,
    ProductSerializer,
    VisitCreateSerializer,
    VisitSerializer,
)
from .utils import check_travel_from_last_visit, haversine_meters


def _allowed_activity_type_values(user):
    """Return set of activity_type values allowed for this user's department (uses prefetch, no N+1)."""
    user_dept_slug = (user.department.slug if user.department else "")
    allowed = set()
    for at in ActivityTypeConfig.objects.prefetch_related("departments"):
        depts = list(at.departments.all())
        if not depts or (user_dept_slug and any(d.slug == user_dept_slug for d in depts)):
            allowed.add(at.value)
    return allowed if allowed else {Visit.ActivityType.FARM_TO_FARM_VISITS}


def _resolve_product_focus(product_focus_id, department_id):
    """If product_focus_id is a product in the given department, return its UUID; else None."""
    if not product_focus_id or not department_id:
        return None
    try:
        product = Product.objects.filter(
            department_id=department_id,
            id=product_focus_id,
        ).values_list("id", flat=True).first()
        return product
    except Exception:
        return None


logger = logging.getLogger(__name__)


def _validate_photo(file):
    """Validate file type and size. Max from site config or 5MB."""
    from site_config.services import get_visit_photo_max_size_mb
    if not file:
        return None, "Photo is required."
    max_mb = get_visit_photo_max_size_mb()
    max_bytes = max_mb * 1024 * 1024
    if file.size > max_bytes:
        return None, f"Photo must be under {max_mb}MB."
    allowed = getattr(
        django_settings, "VISIT_PHOTO_ALLOWED_EXTENSIONS", ("image/jpeg", "image/png", "image/jpg")
    )
    if file.content_type not in allowed:
        return None, "Allowed types: JPEG, PNG."
    return None, None


class VisitListCreateView(generics.ListCreateAPIView):
    parser_classes = (MultiPartParser, FormParser)
    list_serializer_class = VisitSerializer
    create_serializer_class = VisitCreateSerializer

    def get_serializer_class(self):
        if self.request.method == "POST":
            return self.create_serializer_class
        return self.list_serializer_class

    def get_queryset(self):
        user = self.request.user
        qs = Visit.objects.select_related(
            "officer", "officer__department", "farmer", "farm", "schedule", "schedule__farmer", "product_focus"
        ).prefetch_related("photos", "product_lines__product")
        if user.role == "admin":
            return qs
        if user.role == "supervisor":
            # Supervisors see only visits by officers in their department.
            if user.department_id:
                return qs.filter(officer__department=user.department)
            return qs.none()
        return qs.filter(officer=user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        officer_id = request.query_params.get("officer")
        if officer_id:
            queryset = queryset.filter(officer_id=officer_id)
        farmer_id = request.query_params.get("farmer")
        if farmer_id:
            queryset = queryset.filter(farmer_id=farmer_id)
        farm_id = request.query_params.get("farm")
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)
        date_str = request.query_params.get("date")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_from and date_to:
            queryset = queryset.filter(
                created_at__date__gte=date_from,
                created_at__date__lte=date_to,
            )
        elif date_str:
            queryset = queryset.filter(created_at__date=date_str)
        if request.user.role == "admin":
            department_slug = request.query_params.get("department")
            if department_slug:
                queryset = queryset.filter(officer__department__slug=department_slug)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.list_serializer_class(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.list_serializer_class(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.warning("POST /api/visits/ validation failed: %s", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = dict(serializer.validated_data)
        # FormData sends activity_types as multiple keys; getlist returns the list
        if hasattr(request.data, "getlist"):
            activity_types_list = request.data.getlist("activity_types")
            if activity_types_list:
                data["activity_types"] = [str(a).strip() for a in activity_types_list if a]
        farmer_id = data["farmer_id"]
        farm_id = data.get("farm_id")
        schedule_id = data["schedule_id"]
        lat = float(data["latitude"])
        lon = float(data["longitude"])
        photo_list = request.FILES.getlist("photo") if hasattr(request.FILES, "getlist") else []
        if not photo_list and request.FILES.get("photo"):
            photo_list = [request.FILES.get("photo")]
        user = request.user
        from site_config.services import get_labels_for_user
        partner_label, location_label = get_labels_for_user(user)

        if not photo_list:
            return Response({"photo": ["At least one photo is required."]}, status=status.HTTP_400_BAD_REQUEST)
        for i, f in enumerate(photo_list):
            err_msg = _validate_photo(f)[1]
            if err_msg:
                logger.warning("POST /api/visits/ photo %s invalid: %s", i, err_msg)
                return Response({"photo": [err_msg]}, status=status.HTTP_400_BAD_REQUEST)
        primary_photo = photo_list[0]
        extra_photos = photo_list[1:]

        try:
            farmer = Farmer.objects.prefetch_related("farms").get(pk=farmer_id)
        except Farmer.DoesNotExist:
            logger.warning("POST /api/visits/ farmer_id=%s not found", farmer_id)
            return Response({"farmer_id": [f"{partner_label} not found."]}, status=status.HTTP_404_NOT_FOUND)
        allowed_activities = _allowed_activity_type_values(user)
        activity_types_raw = data.get("activity_types")
        if activity_types_raw and isinstance(activity_types_raw, list) and len(activity_types_raw) > 0:
            activity_types = [str(a).strip() for a in activity_types_raw if a]
            invalid = [a for a in activity_types if a not in allowed_activities]
            if invalid:
                logger.warning(
                    "POST /api/visits/ activity_types %s not allowed for user=%s",
                    invalid,
                    user.id,
                )
                return Response(
                    {"activity_types": ["These activity types are not allowed for your department: " + ", ".join(invalid)]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            activity_type = activity_types[0]
        else:
            activity_type = data.get("activity_type") or Visit.ActivityType.FARM_TO_FARM_VISITS
            if activity_type not in allowed_activities:
                logger.warning(
                    "POST /api/visits/ activity_type=%s not allowed for user=%s department=%s",
                    activity_type,
                    user.id,
                    user.department.slug if user.department else "",
                )
                return Response(
                    {"activity_type": ["This activity type is not allowed for your department."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            activity_types = [activity_type]

        # Reject if this location is impossibly far from the officer's last visit (e.g. Thika then Naivasha in minutes).
        from site_config.services import get_visit_max_travel_speed_kmh, get_visit_travel_validation_window_hours
        window_h = get_visit_travel_validation_window_hours()
        max_kmh = get_visit_max_travel_speed_kmh()
        travel_err, travel_extra = check_travel_from_last_visit(
            user.pk, lat, lon, window_hours=window_h, max_speed_kmh=max_kmh
        )
        if travel_err:
            logger.warning("POST /api/visits/ travel validation failed: %s", travel_err)
            payload = {"detail": travel_err}
            if travel_extra:
                payload["travel_validation"] = travel_extra
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        if user.role != "admin" and farmer.assigned_officer_id != user.pk:
            logger.warning("POST /api/visits/ forbidden user=%s not assigned to farmer_id=%s", user.id, farmer_id)
            return Response(
                {"farmer_id": [f"You are not assigned to this {partner_label.lower()}."]},
                status=status.HTTP_403_FORBIDDEN,
            )

        ref_lat, ref_lon = None, None
        farm = None
        if farm_id:
            try:
                farm = Farm.objects.select_related("farmer").get(pk=farm_id, farmer=farmer)
                ref_lat, ref_lon = float(farm.latitude), float(farm.longitude)
            except Farm.DoesNotExist:
                logger.warning("POST /api/visits/ farm_id=%s not found for farmer_id=%s", farm_id, farmer_id)
                return Response(
                    {"farm_id": [f"{location_label} not found or does not belong to this {partner_label.lower()}."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if ref_lat is None and farmer.farms.exists():
            farms = list(farmer.farms.all())
            min_d = float("inf")
            for f in farms:
                d = haversine_meters(lat, lon, float(f.latitude), float(f.longitude))
                if d < min_d:
                    min_d = d
                    ref_lat, ref_lon = float(f.latitude), float(f.longitude)
                    farm = f
        if ref_lat is None:
            ref_lat, ref_lon = float(farmer.latitude), float(farmer.longitude)

        try:
            schedule = Schedule.objects.select_related("officer", "farmer").get(pk=schedule_id)
        except Schedule.DoesNotExist:
            logger.warning("POST /api/visits/ schedule_id=%s not found", schedule_id)
            return Response(
                {"schedule_id": ["Schedule not found."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if schedule.status != Schedule.Status.ACCEPTED:
            return Response(
                {"schedule_id": ["Only accepted (planned) schedules can have visits recorded."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if schedule.officer_id != user.pk:
            logger.warning("POST /api/visits/ schedule_id=%s officer mismatch user=%s", schedule_id, user.id)
            return Response(
                {"schedule_id": ["This schedule is not assigned to you."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if schedule.farmer_id and schedule.farmer_id != farmer_id:
            return Response(
                {"schedule_id": [f"Schedule is for a different {partner_label.lower()}."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        today = timezone.now().date()
        if schedule.scheduled_date > today:
            return Response(
                {"schedule_id": ["Cannot record a visit for a schedule in the future."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if Visit.objects.filter(schedule=schedule).exists():
            return Response(
                {"schedule_id": ["A visit has already been recorded for this schedule."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from site_config.services import get_visit_max_distance_meters
        max_m = get_visit_max_distance_meters()
        distance = haversine_meters(lat, lon, ref_lat, ref_lon)
        if distance > max_m:
            msg = (
                f"Visit rejected: officer is {distance:.0f}m from {partner_label.lower()}/{location_label.lower()} "
                f"(max {max_m}m allowed)."
            )
            logger.warning("POST /api/visits/ %s", msg)
            return Response(
                {
                    "detail": msg,
                    "distance_meters": round(distance, 1),
                    "max_allowed_meters": max_m,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        visit = Visit.objects.create(
            officer=user,
            farmer=farmer,
            farm=farm,
            schedule=schedule,
            latitude=lat,
            longitude=lon,
            notes=data.get("notes", ""),
            photo=primary_photo,
            photo_taken_at=data.get("photo_taken_at"),
            photo_device_info=data.get("photo_device_info") or "",
            photo_place_name=data.get("photo_place_name") or "",
            distance_from_farmer=distance,
            verification_status=Visit.VerificationStatus.PENDING,
            activity_type=activity_type,
            activity_types=activity_types,
            crop_stage=data.get("crop_stage", ""),
            germination_percent=data.get("germination_percent"),
            survival_rate=data.get("survival_rate", ""),
            pests_diseases=data.get("pests_diseases", ""),
            order_value=data.get("order_value"),
            harvest_kgs=data.get("harvest_kgs"),
            farmers_feedback=data.get("farmers_feedback", ""),
            number_of_stockists_visited=data.get("number_of_stockists_visited"),
            product_focus_id=_resolve_product_focus(data.get("product_focus_id"), user.department_id),
            merchandising=data.get("merchandising", ""),
            counter_training=data.get("counter_training", ""),
        )
        from .models import VisitPhoto
        for i, f in enumerate(extra_photos):
            VisitPhoto.objects.create(visit=visit, image=f, order=i)

        product_lines_raw = data.get("product_lines")
        if product_lines_raw is None and hasattr(request.data, "get"):
            product_lines_raw = request.data.get("product_lines")
        if isinstance(product_lines_raw, str) and product_lines_raw.strip():
            try:
                product_lines_raw = json.loads(product_lines_raw)
            except json.JSONDecodeError:
                product_lines_raw = []
        if isinstance(product_lines_raw, list) and product_lines_raw and user.department_id:
            allowed_product_ids = set(
                Product.objects.filter(department_id=user.department_id).values_list("id", flat=True)
            )
            for line in product_lines_raw:
                if not isinstance(line, dict):
                    continue
                pid = line.get("product_id")
                if not pid or str(pid) not in {str(a) for a in allowed_product_ids}:
                    continue
                qty_sold = line.get("quantity_sold")
                qty_given = line.get("quantity_given")
                if qty_sold is None and qty_given is None:
                    continue
                from decimal import Decimal
                try:
                    sold = Decimal(str(qty_sold)) if qty_sold is not None else Decimal("0")
                    given = Decimal(str(qty_given)) if qty_given is not None else Decimal("0")
                except Exception:
                    continue
                if sold < 0 or given < 0:
                    continue
                if sold == 0 and given == 0:
                    continue
                product_id = next(a for a in allowed_product_ids if str(a) == str(pid))
                VisitProduct.objects.update_or_create(
                    visit=visit,
                    product_id=product_id,
                    defaults={"quantity_sold": sold, "quantity_given": given},
                )

        from django.contrib.auth import get_user_model

        from notifications.services import notify_user

        User = get_user_model()
        if getattr(user, "region_id_id", None):
            supervisors_same_region = User.objects.filter(
                role=User.Role.SUPERVISOR, region_id_id=user.region_id_id
            ).exclude(pk=user.pk)
        else:
            supervisors_same_region = User.objects.none()
        admins = User.objects.filter(role=User.Role.ADMIN)
        for recipient in list(supervisors_same_region) + list(admins):
            notify_user(
                recipient,
                title="New visit recorded",
                message=f"{user.email} recorded a visit to {farmer.name}.",
                channels=["in_app", "email", "sms", "push"],
            )
        logger.info(
            "POST /api/visits/ created visit_id=%s farmer_id=%s by user=%s distance=%.0fm",
            visit.id,
            farmer_id,
            user.id,
            distance,
        )
        visit = Visit.objects.select_related(
            "officer", "farmer", "farm", "schedule", "schedule__farmer"
        ).prefetch_related("product_lines__product").get(pk=visit.pk)
        out_serializer = VisitSerializer(visit)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)


class VisitRetrieveView(generics.RetrieveAPIView):
    """GET a single visit by id. Officers see own; supervisors see department."""
    permission_classes = [IsAuthenticated]
    serializer_class = VisitSerializer
    queryset = Visit.objects.select_related(
        "officer", "officer__department", "farmer", "farm", "schedule", "schedule__farmer"
    ).prefetch_related("photos", "product_lines__product")

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.role == "admin":
            return qs
        if user.role == "supervisor":
            if user.department_id:
                return qs.filter(officer__department=user.department)
            return qs.none()
        return qs.filter(officer=user)


class VisitVerifyView(APIView):
    """POST with {"action": "accept" | "reject"}. Supervisor or admin only. Sets visit verification_status."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            visit = Visit.objects.select_related("officer", "officer__department", "farmer", "schedule").get(pk=pk)
        except Visit.DoesNotExist:
            return Response(
                {"detail": "Visit not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        user = request.user
        if user.role not in ("admin", "supervisor"):
            return Response(
                {"detail": "Only supervisors and admins can accept or reject visit records."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if user.role == "supervisor":
            if not user.department_id or visit.officer.department_id != user.department_id:
                return Response(
                    {"detail": "Visit is not in your department."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        action = (request.data.get("action") or "").strip().lower()
        if action == "accept":
            visit.verification_status = Visit.VerificationStatus.VERIFIED
            visit.save(update_fields=["verification_status"])
            logger.info("POST /api/visits/%s/verify accepted by user=%s", pk, user.id)
            from django.utils.formats import date_format
            from notifications.services import notify_user
            date_str = date_format(visit.created_at, use_l10n=True)
            from site_config.services import get_labels_for_user
            _partner_label, _ = get_labels_for_user(visit.officer)
            notify_user(
                visit.officer,
                title="Visit verified",
                message=f"Your visit record from {date_str} ({_partner_label}: {visit.farmer.name}) has been accepted.",
                channels=["in_app", "push"],
            )
            return Response(VisitSerializer(visit).data)
        if action == "reject":
            visit.verification_status = Visit.VerificationStatus.REJECTED
            visit.save(update_fields=["verification_status"])
            logger.info("POST /api/visits/%s/verify rejected by user=%s", pk, user.id)
            from django.utils.formats import date_format
            from notifications.services import notify_user
            date_str = date_format(visit.created_at, use_l10n=True)
            notify_user(
                visit.officer,
                title="Visit rejected",
                message=f"Your visit record from {date_str} has been rejected. Please check and resubmit if needed.",
                channels=["in_app", "push"],
            )
            return Response(VisitSerializer(visit).data)
        return Response(
            {"action": ["Must be 'accept' or 'reject'."]},
            status=status.HTTP_400_BAD_REQUEST,
        )


class ProductListCreateView(generics.ListCreateAPIView):
    """GET: List products (by user's department; admin can pass ?department=slug). POST: Create product (admin only)."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ProductCreateSerializer
        return ProductSerializer

    def get_queryset(self):
        from accounts.models import Department
        user = self.request.user
        qs = Product.objects.select_related("department").order_by("department__name", "name")
        if user.role == "admin":
            dept_slug = (self.request.query_params.get("department") or "").strip()
            if dept_slug:
                qs = qs.filter(department__slug=dept_slug)
            return qs
        if user.department_id:
            return qs.filter(department_id=user.department_id)
        return qs.none()

    def create(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response(
                {"detail": "Only admins can create products."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        out = ProductSerializer(product)
        return Response(out.data, status=status.HTTP_201_CREATED)
