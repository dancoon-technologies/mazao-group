from django.contrib import admin
from .models import Farmer


@admin.register(Farmer)
class FarmerAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "crop_type", "assigned_officer", "created_at")
    list_filter = ("crop_type",)
    search_fields = ("name", "phone")
    raw_id_fields = ("assigned_officer",)
