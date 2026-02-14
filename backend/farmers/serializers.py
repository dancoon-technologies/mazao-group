from rest_framework import serializers
from .models import Farmer


class FarmerSerializer(serializers.ModelSerializer):
    assigned_officer = serializers.UUIDField(source="assigned_officer_id", read_only=True, allow_null=True)

    class Meta:
        model = Farmer
        fields = (
            "id",
            "name",
            "phone",
            "latitude",
            "longitude",
            "crop_type",
            "assigned_officer",
            "created_at",
        )
