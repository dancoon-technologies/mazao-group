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

from .models import ActivityTypeConfig, Visit
from .serializers import VisitCreateSerializer, VisitSerializer
from .utils import haversine_meters


def _allowed_activity_type_values(user):
    """Return set of activity_type values allowed for this user's department (uses prefetch, no N+1)."""
    user_dept_slug = (user.department.slug if user.department else "")
    allowed = set()
    for at in ActivityTypeConfig.objects.prefetch_related("departments"):
        depts = list(at.departments.all())
        if not depts or (user_dept_slug and any(d.slug == user_dept_slug for d in depts)):
            allowed.add(at.value)
    return allowed if allowed else {Visit.ActivityType.FARM_TO_FARM_VISITS}

logger = logging.getLogger(__name__)


def _validate_photo(file):
    """Validate file type and size. Max 5MB."""
    if not file:
        return None, "Photo is required."
    max_bytes = getattr(django_settings, "VISIT_PHOTO_MAX_SIZE_MB", 5) * 1024 * 1024
    if file.size > max_bytes:
        return None, f"Photo must be under {django_settings.VISIT_PHOTO_MAX_SIZE_MB}MB."
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
        qs = Visit.objects.select_related("officer", "officer__department", "farmer", "farm", "schedule", "schedule__farmer")
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
        data = serializer.validated_data
        farmer_id = data["farmer_id"]
        farm_id = data.get("farm_id")
        schedule_id = data["schedule_id"]
        lat = float(data["latitude"])
        lon = float(data["longitude"])
        photo = request.FILES.get("photo")

        err_msg = _validate_photo(photo)[1]
        if err_msg:
            logger.warning("POST /api/visits/ photo invalid: %s", err_msg)
            return Response({"photo": [err_msg]}, status=status.HTTP_400_BAD_REQUEST)

        try:
            farmer = Farmer.objects.prefetch_related("farms").get(pk=farmer_id)
        except Farmer.DoesNotExist:
            logger.warning("POST /api/visits/ farmer_id=%s not found", farmer_id)
            return Response({"farmer_id": ["Farmer not found."]}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        allowed_activities = _allowed_activity_type_values(user)
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
        if user.role != "admin" and farmer.assigned_officer_id != user.pk:
            logger.warning("POST /api/visits/ forbidden user=%s not assigned to farmer_id=%s", user.id, farmer_id)
            return Response(
                {"farmer_id": ["You are not assigned to this farmer."]},
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
                    {"farm_id": ["Farm not found or does not belong to this farmer."]},
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
                {"schedule_id": ["Schedule is for a different farmer."]},
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

        max_m = getattr(django_settings, "VISIT_MAX_DISTANCE_METERS", 100)
        distance = haversine_meters(lat, lon, ref_lat, ref_lon)
        if distance > max_m:
            msg = (
                f"Visit rejected: officer is {distance:.0f}m from farmer/farm "
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
            photo=photo,
            photo_taken_at=data.get("photo_taken_at"),
            photo_device_info=data.get("photo_device_info") or "",
            photo_place_name=data.get("photo_place_name") or "",
            distance_from_farmer=distance,
            verification_status=Visit.VerificationStatus.VERIFIED,
            activity_type=activity_type,
            crop_stage=data.get("crop_stage", ""),
            germination_percent=data.get("germination_percent"),
            survival_rate=data.get("survival_rate", ""),
            pests_diseases=data.get("pests_diseases", ""),
            order_value=data.get("order_value"),
            harvest_kgs=data.get("harvest_kgs"),
            farmers_feedback=data.get("farmers_feedback", ""),
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
                channels=["in_app", "email", "sms"],
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
        ).get(pk=visit.pk)
        out_serializer = VisitSerializer(visit)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)


class VisitRetrieveView(generics.RetrieveAPIView):
    """GET a single visit by id. Officers see own; supervisors see department."""
    permission_classes = [IsAuthenticated]
    serializer_class = VisitSerializer
    queryset = Visit.objects.select_related(
        "officer", "officer__department", "farmer", "farm", "schedule", "schedule__farmer"
    )

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
            notify_user(
                visit.officer,
                title="Visit verified",
                message=f"Your visit record from {date_str} (Farmer: {visit.farmer.name}) has been accepted.",
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
