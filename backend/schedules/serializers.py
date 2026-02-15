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
            "created_at",
        )


class ScheduleCreateSerializer(serializers.ModelSerializer):
    officer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.OFFICER)
    )
    farmer = serializers.PrimaryKeyRelatedField(
        queryset=Farmer.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Schedule
        fields = ("officer", "farmer", "scheduled_date", "notes")
