from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Farmer, Farm
from locations.models import County, SubCounty, Region

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


class FarmSerializer(serializers.ModelSerializer):
    farmer = serializers.UUIDField(source="farmer_id", read_only=True)
    region = serializers.SerializerMethodField()
    county = serializers.SerializerMethodField()
    sub_county = serializers.SerializerMethodField()

    class Meta:
        model = Farm
        fields = (
            "id",
            "farmer",
            "region_id",
            "region",
            "county_id",
            "county",
            "sub_county_id",
            "sub_county",
            "village",
            "latitude",
            "longitude",
            "plot_size",
            "crop_type",
            "created_at",
        )
        read_only_fields = ("created_at",)

    def get_region(self, obj):
        return obj.region_id.name

    def get_county(self, obj):
        return obj.county_id.name

    def get_sub_county(self, obj):
        return obj.sub_county_id.name

class FarmCreateSerializer(serializers.ModelSerializer):
    farmer_id = serializers.UUIDField(write_only=True)
    region_id = serializers.PrimaryKeyRelatedField(
        queryset=Region.objects.all(),
        required=True,
    )
    county_id = serializers.PrimaryKeyRelatedField(
        queryset=County.objects.all(),
        required=True,
    )
    sub_county_id = serializers.PrimaryKeyRelatedField(
        queryset=SubCounty.objects.all(),
        required=True,
    )

    class Meta:
        model = Farm
        fields = ("farmer_id", "region_id", "county_id", "sub_county_id", "village", "latitude", "longitude", "plot_size", "crop_type")
