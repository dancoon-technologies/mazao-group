from rest_framework import serializers

from .models import Visit


class VisitSerializer(serializers.ModelSerializer):
    officer = serializers.UUIDField(source="officer_id", read_only=True)
    farmer = serializers.UUIDField(source="farmer_id", read_only=True)
    farm = serializers.UUIDField(source="farm_id", read_only=True, allow_null=True)
    schedule = serializers.UUIDField(source="schedule_id", read_only=True, allow_null=True)
    officer_email = serializers.SerializerMethodField()
    farmer_display_name = serializers.SerializerMethodField()
    farm_display_name = serializers.SerializerMethodField()
    schedule_display = serializers.SerializerMethodField()

    class Meta:
        model = Visit
        fields = (
            "id",
            "officer",
            "officer_email",
            "farmer",
            "farmer_display_name",
            "farm",
            "farm_display_name",
            "schedule",
            "schedule_display",
            "latitude",
            "longitude",
            "photo",
            "photo_taken_at",
            "photo_device_info",
            "photo_place_name",
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
        )
        read_only_fields = (
            "officer",
            "farmer",
            "distance_from_farmer",
            "verification_status",
            "created_at",
        )

    def get_officer_email(self, obj):
        return obj.officer.email if obj.officer_id else ""

    def get_farmer_display_name(self, obj):
        return obj.farmer.name if obj.farmer_id else ""

    def get_farm_display_name(self, obj):
        if obj.farm_id and obj.farm:
            return str(obj.farm)
        return None

    def get_schedule_display(self, obj):
        if obj.schedule_id and obj.schedule:
            return f"{obj.schedule.scheduled_date} — {obj.schedule.farmer.name if obj.schedule.farmer_id else 'N/A'}"
        return None


class VisitCreateSerializer(serializers.ModelSerializer):
    farmer_id = serializers.UUIDField(write_only=True)
    farm_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    schedule_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    photo_taken_at = serializers.DateTimeField(required=False, allow_null=True)
    photo_device_info = serializers.CharField(required=False, allow_blank=True, default="", max_length=120)
    photo_place_name = serializers.CharField(required=False, allow_blank=True, default="", max_length=120)

    class Meta:
        model = Visit
        extra_kwargs = {
            "notes": {"max_length": 2000},
            "farmers_feedback": {"max_length": 2000},
        }
        fields = (
            "farmer_id",
            "farm_id",
            "schedule_id",
            "latitude",
            "longitude",
            "notes",
            "photo",
            "photo_taken_at",
            "photo_device_info",
            "photo_place_name",
            "activity_type",
            "crop_stage",
            "germination_percent",
            "survival_rate",
            "pests_diseases",
            "order_value",
            "harvest_kgs",
            "farmers_feedback",
        )
