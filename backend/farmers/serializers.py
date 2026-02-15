from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Farmer

User = get_user_model()


class FarmerSerializer(serializers.ModelSerializer):
    assigned_officer = serializers.UUIDField(source="assigned_officer_id", read_only=True, allow_null=True)
    display_name = serializers.ReadOnlyField(source="name")

    class Meta:
        model = Farmer
        fields = (
            "id",
            "title",
            "first_name",
            "middle_name",
            "last_name",
            "display_name",
            "phone",
            "latitude",
            "longitude",
            "crop_type",
            "assigned_officer",
            "created_at",
        )


class FarmerCreateSerializer(serializers.ModelSerializer):
    assigned_officer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role="officer"),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Farmer
        fields = ("title", "first_name", "middle_name", "last_name", "phone", "latitude", "longitude", "crop_type", "assigned_officer")
