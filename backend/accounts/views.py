import logging
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Department, User

logger = logging.getLogger(__name__)
from .serializers import StaffCreateSerializer, StaffPatchSerializer, UserSerializer
from .services import resend_staff_credentials


class OptionsListView(APIView):
    """GET: Option sets for forms (departments, staff_roles, activity_types by department). Requires auth.
    activity_types: only active ones (is_active=True); each includes form_fields for visit step 3."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        logger.debug("GET /api/options/")
        departments = [
            {"value": d.slug, "label": d.name} for d in Department.objects.all()
        ]
        staff_roles = [
            {"value": User.Role.SUPERVISOR, "label": dict(User.Role.choices)[User.Role.SUPERVISOR]},
            {"value": User.Role.OFFICER, "label": dict(User.Role.choices)[User.Role.OFFICER]},
        ]
        from site_config.services import (
            get_labels_for_user,
            get_visit_max_distance_meters,
            get_visit_warning_distance_meters,
        )
        from visits.visit_form_schema import DEFAULT_VISIT_FORM_FIELDS, VISIT_FORM_FIELD_SCHEMA

        visit_max_m = get_visit_max_distance_meters()
        visit_warning_m = get_visit_warning_distance_meters()
        partner_label, location_label = get_labels_for_user(request.user)

        # Activity types: only is_active=True, scoped by department (prefetch used to avoid N+1).
        # - Activity with no departments = visible to all.
        # - Activity with departments = visible only to users in one of those departments.
        # - User with no department = sees all active types (e.g. admin/unassigned).
        activity_types = []
        try:
            from visits.models import ActivityTypeConfig
            user_dept_slug = (request.user.department.slug if request.user.department else "")
            qs = ActivityTypeConfig.objects.filter(is_active=True).prefetch_related("departments").order_by("order", "label")
            for at in qs:
                depts = list(at.departments.all())
                visible = (
                    not depts
                    or not user_dept_slug
                    or any(d.slug == user_dept_slug for d in depts)
                )
                if visible:
                    item = {
                        "value": at.value,
                        "label": at.label,
                        "is_active": getattr(at, "is_active", True),
                    }
                    # form_fields: per-activity step-3 fields from DB; mobile uses these for "Additional details".
                    item["form_fields"] = getattr(at, "form_fields", None) or []
                    activity_types.append(item)
        except Exception as e:
            logger.warning("Options activity_types: %s", e)

        # Products for the user's department (for recording sales during visits).
        products = []
        try:
            from visits.models import Product
            if request.user.department_id:
                products = [
                    {"id": str(p.id), "name": p.name, "code": p.code or "", "unit": p.unit or ""}
                    for p in Product.objects.filter(department_id=request.user.department_id).order_by("name")
                ]
        except Exception as e:
            logger.warning("Options products: %s", e)

        tracking_working_start = 6
        tracking_working_end = 18
        tracking_interval_minutes = 1
        try:
            from tracking.models import TrackingSettings
            ts = TrackingSettings.objects.first()
            if ts:
                tracking_working_start = max(0, min(23, ts.working_hour_start))
                tracking_working_end = max(0, min(23, ts.working_hour_end))
                tracking_interval_minutes = max(1, min(120, ts.interval_minutes))
        except Exception as e:
            logger.warning("Options tracking_settings: %s", e)

        # Step-3 form: schema (key -> input_type, value_type, api_key) and default fields when activity has none
        default_visit_form_fields = [
            {**item, "label": item["label"].format(partner=partner_label) if "{partner}" in item.get("label", "") else item["label"]}
            for item in DEFAULT_VISIT_FORM_FIELDS
        ]
        return Response(
            {
                "departments": departments,
                "staff_roles": staff_roles,
                "visit_settings": {
                    "max_distance_meters": visit_max_m,
                    "warning_distance_meters": visit_warning_m,
                },
                "labels": {
                    "partner": partner_label,
                    "location": location_label,
                },
                "activity_types": activity_types,
                "products": products,
                "visit_form_field_schema": VISIT_FORM_FIELD_SCHEMA,
                "default_visit_form_fields": default_visit_form_fields,
                "tracking_settings": {
                    "working_hour_start": tracking_working_start,
                    "working_hour_end": tracking_working_end,
                    "interval_minutes": tracking_interval_minutes,
                },
            }
        )


class OfficersListView(generics.ListAPIView):
    """List officers for schedule assignment. Admin: all; Supervisor: same region."""

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role not in ("admin", "supervisor"):
            return User.objects.none()
        qs = (
            User.objects.filter(role=User.Role.OFFICER)
            .select_related("department", "region_id", "county_id", "sub_county_id")
            .order_by("email")
        )
        if user.role == "supervisor":
            # Supervisors see only officers in their department.
            if user.department_id:
                qs = qs.filter(department=user.department)
            else:
                qs = User.objects.none()
        return qs


class StaffListCreateView(generics.ListCreateAPIView):
    """List and register staff (supervisors and extension officers). Admin only."""

    list_serializer_class = UserSerializer
    create_serializer_class = StaffCreateSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return self.create_serializer_class
        return self.list_serializer_class

    def get_queryset(self):
        if self.request.user.role != "admin":
            return User.objects.none()
        return (
            User.objects.filter(role__in=(User.Role.SUPERVISOR, User.Role.OFFICER))
            .select_related("department", "region_id", "county_id", "sub_county_id")
            .order_by("role", "email")
        )

    def list(self, request, *args, **kwargs):
        if request.user.role != "admin":
            logger.warning("GET /api/staff/ forbidden: user=%s role=%s", request.user.id, request.user.role)
            return Response(
                {"detail": "Only admins can list staff."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if request.user.role != "admin":
            logger.warning("POST /api/staff/ forbidden: user=%s", request.user.id)
            return Response(
                {"detail": "Only admins can register staff."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.warning("POST /api/staff/ validation failed: %s", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.save()
        logger.info("POST /api/staff/ created staff_id=%s email=%s by admin=%s", user.id, user.email, request.user.id)
        out = UserSerializer(user)
        return Response(out.data, status=status.HTTP_201_CREATED)


class StaffUpdateView(generics.GenericAPIView):
    """GET: fetch one staff by id. PATCH: update staff. Admin only."""

    permission_classes = [IsAuthenticated]
    serializer_class = StaffPatchSerializer

    def get(self, request, pk):
        if request.user.role != "admin":
            return Response(
                {"detail": "Only admins can view staff details."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            user = User.objects.select_related("department", "region_id", "county_id", "sub_county_id").get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"detail": "Staff member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if user.role not in (User.Role.SUPERVISOR, User.Role.OFFICER):
            return Response(
                {"detail": "User is not staff."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(UserSerializer(user).data)

    def patch(self, request, pk):
        if request.user.role != "admin":
            logger.warning("PATCH /api/staff/%s forbidden: user=%s", pk, request.user.id)
            return Response(
                {"detail": "Only admins can update staff."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            user = User.objects.select_related("department", "region_id", "county_id", "sub_county_id").get(pk=pk)
        except User.DoesNotExist:
            logger.warning("PATCH /api/staff/%s staff not found", pk)
            return Response(
                {"detail": "Staff member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if user.role not in (User.Role.SUPERVISOR, User.Role.OFFICER):
            logger.warning("PATCH /api/staff/%s user is not staff role=%s", pk, user.role)
            return Response(
                {"detail": "User is not staff (supervisor or officer)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = StaffPatchSerializer(user, data=request.data, partial=True)
        if not serializer.is_valid():
            logger.warning("PATCH /api/staff/%s validation failed: %s", pk, serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        user.refresh_from_db()
        logger.info("PATCH /api/staff/%s updated by admin=%s", pk, request.user.id)
        return Response(UserSerializer(user).data)


class StaffPerformanceView(APIView):
    """GET /api/staff/performance/ — list staff with visit counts (visits_today, visits_this_month, visits_total). Admin only."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != "admin":
            return Response(
                {"detail": "Only admins can view staff performance."},
                status=status.HTTP_403_FORBIDDEN,
            )
        today = timezone.now().date()
        start_of_month = today.replace(day=1)
        qs = (
            User.objects.filter(role__in=(User.Role.SUPERVISOR, User.Role.OFFICER))
            .select_related("department", "region_id", "county_id", "sub_county_id")
            .annotate(
                visits_today=Count("visits", filter=Q(visits__created_at__date=today)),
                visits_this_month=Count("visits", filter=Q(visits__created_at__date__gte=start_of_month)),
                visits_total=Count("visits"),
            )
            .order_by("role", "email")
        )
        out = []
        for user in qs:
            data = UserSerializer(user).data
            data["visits_today"] = getattr(user, "visits_today", 0) or 0
            data["visits_this_month"] = getattr(user, "visits_this_month", 0) or 0
            data["visits_total"] = getattr(user, "visits_total", 0) or 0
            out.append(data)
        logger.info("GET /api/staff/performance/ admin=%s count=%s", request.user.id, len(out))
        return Response(out)


class ChangePasswordView(generics.GenericAPIView):
    """POST with current_password and new_password. Clears must_change_password and returns new tokens."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        current = request.data.get("current_password")
        new_password = request.data.get("new_password")
        if not current or not new_password:
            logger.warning("POST /api/auth/change-password/ missing fields user=%s", request.user.id)
            return Response(
                {"detail": "current_password and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user
        if not user.check_password(current):
            logger.warning("POST /api/auth/change-password/ wrong current password user=%s", user.id)
            return Response(
                {"current_password": ["Current password is incorrect."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(new_password)
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        user.refresh_from_db()  # ensure in-memory state is in sync for any downstream use
        logger.info("POST /api/auth/change-password/ success user=%s", user.id)
        from notifications.services import notify_user

        notify_user(
            user,
            title="Password changed",
            message="Your password was changed successfully.",
            channels=["in_app", "push"],
            action_data={"screen": "profile"},
        )
        from accounts.auth_views import EmailTokenObtainPairSerializer

        refresh = EmailTokenObtainPairSerializer.get_token(user)
        jti = refresh.get("jti")
        if jti:
            user.current_refresh_jti = jti
            user.save(update_fields=["current_refresh_jti"])
        return Response(
            {
                "detail": "Password changed successfully.",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }
        )


class StaffResendCredentialsView(generics.GenericAPIView):
    """POST to resend login credentials email to a staff member. Admin only."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != "admin":
            logger.warning("POST /api/staff/%s/resend-credentials/ forbidden user=%s", pk, request.user.id)
            return Response(
                {"detail": "Only admins can resend staff credentials."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            user = User.objects.select_related("department").get(pk=pk)
        except User.DoesNotExist:
            logger.warning("POST /api/staff/%s/resend-credentials/ staff not found", pk)
            return Response(
                {"detail": "Staff member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if user.role not in (User.Role.SUPERVISOR, User.Role.OFFICER):
            logger.warning("POST /api/staff/%s/resend-credentials/ not staff role=%s", pk, user.role)
            return Response(
                {"detail": "User is not staff (supervisor or officer)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            resend_staff_credentials(user)
        except Exception as e:
            logger.exception("POST /api/staff/%s/resend-credentials/ send failed: %s", pk, e)
            return Response(
                {"detail": str(e) or "Failed to send email."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        logger.info("POST /api/staff/%s/resend-credentials/ sent to %s by admin=%s", pk, user.email, request.user.id)
        from notifications.services import notify_user

        notify_user(
            user,
            title="Login credentials resent",
            message="Your temporary login credentials have been sent to your email again.",
            channels=["in_app", "push"],
            action_data={"screen": "notifications"},
        )
        return Response(
            {"detail": f"Credentials email sent to {user.email}."},
            status=status.HTTP_200_OK,
        )


class StaffResetDeviceView(generics.GenericAPIView):
    """POST to clear bound device/session for a staff member. Admin or supervisor."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in (User.Role.ADMIN, User.Role.SUPERVISOR):
            logger.warning("POST /api/staff/%s/reset-device/ forbidden user=%s", pk, request.user.id)
            return Response(
                {"detail": "Only admins or supervisors can reset a staff device."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            user = User.objects.select_related("department").get(pk=pk)
        except User.DoesNotExist:
            logger.warning("POST /api/staff/%s/reset-device/ staff not found", pk)
            return Response(
                {"detail": "Staff member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if user.role not in (User.Role.SUPERVISOR, User.Role.OFFICER):
            return Response(
                {"detail": "User is not staff (supervisor or officer)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if request.user.role == User.Role.SUPERVISOR:
            if not request.user.department_id or user.department_id != request.user.department_id:
                return Response(
                    {"detail": "Staff member is not in your department."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        user.device_id = ""
        user.current_access_jti = ""
        user.current_refresh_jti = ""
        user.save(update_fields=["device_id", "current_access_jti", "current_refresh_jti"])
        logger.info("POST /api/staff/%s/reset-device/ by user=%s", pk, request.user.id)
        from notifications.services import notify_user

        notify_user(
            user,
            title="Device access reset",
            message="Your device binding was reset. Sign in again on your assigned phone.",
            channels=["in_app", "push"],
            action_data={"screen": "notifications"},
        )
        return Response(
            {"detail": f"Device binding reset for {user.email}."},
            status=status.HTTP_200_OK,
        )
