from rest_framework import serializers

from .models import LocationReport


class LocationReportCreateSerializer(serializers.ModelSerializer):
    """For mobile: submit one or many reports. reported_at = device time (ISO string)."""

    reported_at = serializers.DateTimeField()
    accuracy = serializers.FloatField(required=False, allow_null=True)
    battery_percent = serializers.FloatField(required=False, allow_null=True)
    device_info = serializers.JSONField(required=False, default=dict)

    class Meta:
        model = LocationReport
        fields = (
            "reported_at",
            "latitude",
            "longitude",
            "accuracy",
            "battery_percent",
            "device_info",
        )


class LocationReportSerializer(serializers.ModelSerializer):
    """Read-only for admin: include user email and id."""

    user_id = serializers.UUIDField(read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_display_name = serializers.SerializerMethodField()

    class Meta:
        model = LocationReport
        fields = (
            "id",
            "user_id",
            "user_email",
            "user_display_name",
            "reported_at",
            "latitude",
            "longitude",
            "accuracy",
            "battery_percent",
            "device_info",
            "created_at",
        )

    def get_user_display_name(self, obj):
        if obj.user_id:
            return getattr(obj.user, "display_name", None) or obj.user.email
        return None
