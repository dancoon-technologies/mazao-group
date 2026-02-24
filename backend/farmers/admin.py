from django.contrib import admin
from .models import Farmer, Farm


@admin.register(Farmer)
class FarmerAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "phone", "crop_type", "assigned_officer", "created_at")
    list_filter = ("crop_type",)
    search_fields = ("first_name", "middle_name", "last_name", "phone")
    raw_id_fields = ("assigned_officer",)


@admin.register(Farm)
class FarmAdmin(admin.ModelAdmin):
    list_display = ("farmer", "region_id", "county_id", "sub_county_id", "village", "plot_size", "crop_type", "created_at")
    list_filter = ("region_id", "county_id", "sub_county_id")
    search_fields = ("village", "region_id", "county_id", "sub_county_id")
    raw_id_fields = ("farmer",)
