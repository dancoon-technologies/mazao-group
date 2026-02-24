from rest_framework import serializers

from .models import County, Region, SubCounty


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ("id", "name")


class CountySerializer(serializers.ModelSerializer):
    class Meta:
        model = County
        fields = ("id", "region_id", "name")


class SubCountySerializer(serializers.ModelSerializer):
    class Meta:
        model = SubCounty
        fields = ("id", "county_id", "name")
