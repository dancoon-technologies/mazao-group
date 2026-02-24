from rest_framework import serializers
from .models import Visit


class VisitSerializer(serializers.ModelSerializer):
    officer = serializers.UUIDField(source="officer_id", read_only=True)
    farmer = serializers.UUIDField(source="farmer_id", read_only=True)
    farm = serializers.UUIDField(source="farm_id", read_only=True, allow_null=True)
    officer_email = serializers.SerializerMethodField()
    farmer_display_name = serializers.SerializerMethodField()
    farm_display_name = serializers.SerializerMethodField()

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


class VisitCreateSerializer(serializers.ModelSerializer):
    farmer_id = serializers.UUIDField(write_only=True)
    farm_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Visit
        fields = (
            "farmer_id",
            "farm_id",
            "latitude",
            "longitude",
            "notes",
            "photo",
            "activity_type",
            "crop_stage",
            "germination_percent",
            "survival_rate",
            "pests_diseases",
            "order_value",
            "harvest_kgs",
            "farmers_feedback",
        )
