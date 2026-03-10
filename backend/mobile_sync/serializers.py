from rest_framework import serializers

from schedules.models import Schedule
from visits.models import Visit


class VisitSyncSerializer(serializers.ModelSerializer):
    schedule = serializers.UUIDField(source="schedule_id", read_only=True, allow_null=True)

    class Meta:
        model = Visit
        fields = [
            "id",
            "officer",
            "farmer",
            "farm",
            "schedule",
            "latitude",
            "longitude",
            "photo",
            "notes",
            "distance_from_farmer",
            "verification_status",
            "activity_type",
            "crop_stage",
            "germination_percent",
            "survival_rate",
            "pests_diseases",
            "order_value",
            "harvest_kgs",
            "farmers_feedback",
            "created_at",
            "updated_at",
            "is_deleted",
        ]


class ScheduleSyncSerializer(serializers.ModelSerializer):
    farmer = serializers.UUIDField(source="farmer_id", read_only=True, allow_null=True)
    farmer_display_name = serializers.CharField(
        source="farmer.name", read_only=True, allow_null=True
    )
    farm = serializers.UUIDField(source="farm_id", read_only=True, allow_null=True)
    farm_display_name = serializers.SerializerMethodField()

    class Meta:
        model = Schedule
        fields = [
            "id",
            "officer",
            "farmer",
            "farmer_display_name",
            "farm",
            "farm_display_name",
            "scheduled_date",
            "notes",
            "status",
            "created_by",
            "approved_by",
            "created_at",
            "updated_at",
            "is_deleted",
        ]

    def get_farm_display_name(self, obj):
        if obj.farm_id and getattr(obj, "farm", None):
            return obj.farm.village
        return "None"
