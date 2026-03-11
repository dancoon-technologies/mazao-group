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
    """GET: Option sets for forms (departments, staff_roles, activity_types by department). Requires auth for activity_types."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.conf import settings as django_settings

        logger.debug("GET /api/options/")
        departments = [
            {"value": d.slug, "label": d.name} for d in Department.objects.all()
        ]
        staff_roles = [
            {"value": User.Role.SUPERVISOR, "label": dict(User.Role.choices)[User.Role.SUPERVISOR]},
            {"value": User.Role.OFFICER, "label": dict(User.Role.choices)[User.Role.OFFICER]},
        ]
        visit_max_m = getattr(django_settings, "VISIT_MAX_DISTANCE_METERS", 100)
        visit_warning_m = getattr(django_settings, "VISIT_WARNING_DISTANCE_METERS", 80)

        # Activity types: only those for the user's department (prefetch used to avoid N+1).
        # form_fields: optional list of {key, label, required} for step 3; empty = show all known fields.
        activity_types = []
        try:
            from visits.models import ActivityTypeConfig
            user_dept_slug = (request.user.department.slug if request.user.department else "")
            for at in ActivityTypeConfig.objects.prefetch_related("departments"):
                depts = list(at.departments.all())
                if not depts or (user_dept_slug and any(d.slug == user_dept_slug for d in depts)):
                    item = {"value": at.value, "label": at.label}
                    if getattr(at, "form_fields", None):
                        item["form_fields"] = at.form_fields
                    activity_types.append(item)
        except Exception as e:
            logger.warning("Options activity_types: %s", e)

        return Response(
            {
                "departments": departments,
                "staff_roles": staff_roles,
                "visit_settings": {
                    "max_distance_meters": visit_max_m,
                    "warning_distance_meters": visit_warning_m,
                },
                "activity_types": activity_types,
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
        from rest_framework_simplejwt.tokens import RefreshToken

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
            channels=["in_app"],
        )
        refresh = RefreshToken.for_user(user)
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
            channels=["in_app"],
        )
        return Response(
            {"detail": f"Credentials email sent to {user.email}."},
            status=status.HTTP_200_OK,
        )
