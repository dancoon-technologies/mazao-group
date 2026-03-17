from rest_framework import serializers

from locations.models import County, Region, SubCounty

from .models import Farm, Farmer


class FarmerSerializer(serializers.ModelSerializer):
    display_name = serializers.ReadOnlyField(source="name")

    class Meta:
        model = Farmer
        fields = (
            "id",
            "first_name",
            "middle_name",
            "last_name",
            "display_name",
            "phone",
            "is_stockist",
            "latitude",
            "longitude",
            "created_at",
        )


class FarmerCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Farmer
        fields = (
            "first_name",
            "middle_name",
            "last_name",
            "phone",
            "is_stockist",
            "latitude",
            "longitude",
        )


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
            "is_outlet",
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
    device_latitude = serializers.FloatField(required=False, allow_null=True)
    device_longitude = serializers.FloatField(required=False, allow_null=True)

    class Meta:
        model = Farm
        fields = (
            "farmer_id",
            "region_id",
            "county_id",
            "sub_county_id",
            "village",
            "latitude",
            "longitude",
            "plot_size",
            "crop_type",
            "is_outlet",
            "device_latitude",
            "device_longitude",
        )
