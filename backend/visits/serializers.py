from rest_framework import serializers
from .models import Visit


class VisitSerializer(serializers.ModelSerializer):
    officer = serializers.UUIDField(source="officer_id", read_only=True)
    farmer = serializers.UUIDField(source="farmer_id", read_only=True)

    class Meta:
        model = Visit
        fields = (
            "id",
            "officer",
            "farmer",
            "latitude",
            "longitude",
            "photo",
            "notes",
            "distance_from_farmer",
            "verification_status",
            "created_at",
        )
        read_only_fields = (
            "officer",
            "farmer",
            "distance_from_farmer",
            "verification_status",
            "created_at",
        )


class VisitCreateSerializer(serializers.ModelSerializer):
    farmer_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = Visit
        fields = (
            "farmer_id",
            "latitude",
            "longitude",
            "notes",
            "photo",
        )
