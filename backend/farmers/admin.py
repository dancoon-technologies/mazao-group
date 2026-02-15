from django.contrib import admin
from .models import Farmer


@admin.register(Farmer)
class FarmerAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "phone", "crop_type", "assigned_officer", "created_at")
    list_filter = ("crop_type",)
    search_fields = ("first_name", "middle_name", "last_name", "phone")
    raw_id_fields = ("assigned_officer",)
