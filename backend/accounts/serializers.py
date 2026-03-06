from rest_framework import serializers

from .models import Department, User


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.ReadOnlyField()
    region = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "middle_name",
            "last_name",
            "display_name",
            "phone",
            "role",
            "department",
            "region",
            "region_id",
            "county_id",
            "sub_county_id",
            "is_active",
        )

    def get_region(self, obj):
        """Display string from region_id (location)."""
        if obj.region_id_id and getattr(obj, "region_id", None):
            return obj.region_id.name
        return ""

    def get_department(self, obj):
        """Department slug for API (backward compat)."""
        return obj.department.slug if obj.department else ""


class StaffPatchSerializer(serializers.ModelSerializer):
    """Admin can update is_active, department, location IDs (assign/reassign)."""

    department = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Department.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = ("is_active", "department", "region_id", "county_id", "sub_county_id")


class StaffCreateSerializer(serializers.ModelSerializer):
    """Admin registers a supervisor or extension officer. Password is generated and sent by email."""

    department = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Department.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = (
            "email",
            "role",
            "first_name",
            "middle_name",
            "last_name",
            "phone",
            "department",
            "region_id",
            "county_id",
            "sub_county_id",
        )

    def validate_role(self, value):
        if value not in (User.Role.SUPERVISOR, User.Role.OFFICER):
            raise serializers.ValidationError("Role must be 'supervisor' or 'officer'.")
        return value

    def create(self, validated_data):
        from .services import generate_temporary_password, send_staff_credentials_email

        temporary_password = generate_temporary_password()
        user = User.objects.create_user(
            password=temporary_password,
            must_change_password=True,
            **validated_data,
        )
        try:
            send_staff_credentials_email(
                email=user.email,
                temporary_password=temporary_password,
                name=user.display_name or "",
            )
        except Exception:
            # User is created; log and/or re-raise depending on policy
            raise
        from notifications.services import notify_user

        notify_user(
            user,
            title="You have been registered",
            message="Check your email for your temporary login credentials. You must change your password on first login.",
            channels=["in_app"],
        )
        return user
