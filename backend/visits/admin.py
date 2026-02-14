from django.contrib import admin
from .models import Visit


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = ("officer", "farmer", "verification_status", "distance_from_farmer", "created_at")
    list_filter = ("verification_status", "created_at")
    raw_id_fields = ("officer", "farmer")
    readonly_fields = ("created_at",)
