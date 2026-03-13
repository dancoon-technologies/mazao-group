from django.contrib import admin
from .models import SiteConfig


@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    list_display = (
        "visit_max_distance_meters",
        "visit_warning_distance_meters",
        "visit_travel_validation_window_hours",
        "visit_max_travel_speed_kmh",
        "visit_photo_max_size_mb",
    )
    list_editable = (
        "visit_max_distance_meters",
        "visit_warning_distance_meters",
        "visit_travel_validation_window_hours",
        "visit_max_travel_speed_kmh",
        "visit_photo_max_size_mb",
    )

    def has_add_permission(self, request):
        return not SiteConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
