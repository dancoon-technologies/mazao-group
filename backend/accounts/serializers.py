from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "middle_name", "last_name", "display_name", "phone", "role", "region")


class StaffCreateSerializer(serializers.ModelSerializer):
    """Admin registers a supervisor or extension officer. Password is generated and sent by email."""

    class Meta:
        model = User
        fields = ("email", "role", "first_name", "middle_name", "last_name", "phone", "region")

    def validate_role(self, value):
        if value not in (User.Role.SUPERVISOR, User.Role.OFFICER):
            raise serializers.ValidationError(
                "Role must be 'supervisor' or 'officer'."
            )
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
