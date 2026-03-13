from django.contrib import admin
from .models import DepartmentTerminology, SiteConfig


@admin.register(DepartmentTerminology)
class DepartmentTerminologyAdmin(admin.ModelAdmin):
    list_display = ("id", "department", "partner_label", "location_label")
    list_display_links = ("id",)
    list_editable = ("partner_label", "location_label")
    list_filter = ("department",)
    search_fields = ("department__name", "department__slug", "partner_label", "location_label")
    autocomplete_fields = ("department",)


@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "partner_label",
        "location_label",
        "visit_max_distance_meters",
        "visit_warning_distance_meters",
        "visit_travel_validation_window_hours",
        "visit_max_travel_speed_kmh",
        "visit_photo_max_size_mb",
    )
    list_display_links = ("id",)
    list_editable = (
        "partner_label",
        "location_label",
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
