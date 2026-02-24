from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView

from .models import User
from .serializers import UserSerializer, StaffCreateSerializer, StaffPatchSerializer
from .services import resend_staff_credentials


class OptionsListView(APIView):
    """GET: Option sets for forms (departments, staff_roles). Single source of truth from backend."""
    permission_classes = [AllowAny]

    def get(self, request):
        departments = [
            {"value": choice[0], "label": choice[1]}
            for choice in User.Department.choices
        ]
        staff_roles = [
            {"value": User.Role.SUPERVISOR, "label": dict(User.Role.choices)[User.Role.SUPERVISOR]},
            {"value": User.Role.OFFICER, "label": dict(User.Role.choices)[User.Role.OFFICER]},
        ]
        return Response({
            "departments": departments,
            "staff_roles": staff_roles,
        })


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
            .select_related("region_id", "county_id", "sub_county_id")
            .order_by("email")
        )
        if user.role == "supervisor":
            if getattr(user, "department", None):
                qs = qs.filter(department=user.department)
            elif getattr(user, "region_id_id", None):
                qs = qs.filter(region_id_id=user.region_id_id)
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
        return User.objects.filter(
            role__in=(User.Role.SUPERVISOR, User.Role.OFFICER)
        ).select_related("region_id", "county_id", "sub_county_id").order_by("role", "email")

    def list(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response(
                {"detail": "Only admins can list staff."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response(
                {"detail": "Only admins can register staff."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        out = UserSerializer(user)
        return Response(out.data, status=status.HTTP_201_CREATED)


class StaffUpdateView(generics.GenericAPIView):
    """PATCH staff by id. Admin only. Allow is_active, department, location IDs (deactivate / assign-reassign)."""
    permission_classes = [IsAuthenticated]
    serializer_class = StaffPatchSerializer

    def patch(self, request, pk):
        if request.user.role != "admin":
            return Response(
                {"detail": "Only admins can update staff."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            user = User.objects.select_related("region_id", "county_id", "sub_county_id").get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"detail": "Staff member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if user.role not in (User.Role.SUPERVISOR, User.Role.OFFICER):
            return Response(
                {"detail": "User is not staff (supervisor or officer)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = StaffPatchSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        user.refresh_from_db()
        return Response(UserSerializer(user).data)


class ChangePasswordView(generics.GenericAPIView):
    """POST with current_password and new_password. Clears must_change_password and returns new tokens."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from rest_framework_simplejwt.tokens import RefreshToken

        current = request.data.get("current_password")
        new_password = request.data.get("new_password")
        if not current or not new_password:
            return Response(
                {"detail": "current_password and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user
        if not user.check_password(current):
            return Response(
                {"current_password": ["Current password is incorrect."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(new_password)
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        user.refresh_from_db()  # ensure in-memory state is in sync for any downstream use
        from notifications.services import notify_user
        notify_user(
            user,
            title="Password changed",
            message="Your password was changed successfully.",
            channels=["in_app"],
        )
        refresh = RefreshToken.for_user(user)
        return Response({
            "detail": "Password changed successfully.",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        })


class StaffResendCredentialsView(generics.GenericAPIView):
    """POST to resend login credentials email to a staff member. Admin only."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != "admin":
            return Response(
                {"detail": "Only admins can resend staff credentials."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"detail": "Staff member not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if user.role not in (User.Role.SUPERVISOR, User.Role.OFFICER):
            return Response(
                {"detail": "User is not staff (supervisor or officer)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            resend_staff_credentials(user)
        except Exception as e:
            return Response(
                {"detail": str(e) or "Failed to send email."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        from notifications.services import notify_user
        notify_user(
            user,
            title="Login credentials resent",
            message="Your temporary login credentials have been sent to your email again.",
            channels=["in_app"],
        )
        return Response(
            {"detail": "Credentials email sent to {}.".format(user.email)},
            status=status.HTTP_200_OK,
        )
