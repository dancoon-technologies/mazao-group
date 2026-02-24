from rest_framework import serializers
from farmers.models import Farmer
from accounts.models import User

from .models import Schedule


class ScheduleSerializer(serializers.ModelSerializer):
    created_by = serializers.UUIDField(source="created_by_id", read_only=True)
    officer = serializers.UUIDField(source="officer_id", read_only=True)
    officer_email = serializers.EmailField(source="officer.email", read_only=True)
    farmer = serializers.UUIDField(source="farmer_id", read_only=True, allow_null=True)
    farmer_display_name = serializers.CharField(
        source="farmer.name", read_only=True, allow_null=True
    )
    approved_by = serializers.UUIDField(source="approved_by_id", read_only=True, allow_null=True)

    class Meta:
        model = Schedule
        fields = (
            "id",
            "created_by",
            "officer",
            "officer_email",
            "farmer",
            "farmer_display_name",
            "scheduled_date",
            "notes",
            "status",
            "approved_by",
            "created_at",
        )


class ScheduleCreateSerializer(serializers.ModelSerializer):
    """Admin/supervisor: pass officer, farmer, date, notes. Officer: pass farmer, date, notes (officer=self)."""
    officer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.OFFICER),
        required=False,
        allow_null=True,
    )
    farmer = serializers.PrimaryKeyRelatedField(
        queryset=Farmer.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Schedule
        fields = ("officer", "farmer", "scheduled_date", "notes")
