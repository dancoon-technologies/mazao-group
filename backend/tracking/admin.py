from django.contrib import admin
from .models import LocationReport, TrackingSettings


@admin.register(TrackingSettings)
class TrackingSettingsAdmin(admin.ModelAdmin):
    list_display = ("working_hour_start", "working_hour_end", "interval_minutes")
    list_editable = ("working_hour_start", "working_hour_end", "interval_minutes")

    def has_add_permission(self, request):
        return not TrackingSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LocationReport)
class LocationReportAdmin(admin.ModelAdmin):
    list_display = ("user", "reported_at", "latitude", "longitude", "battery_percent", "created_at")
    list_filter = ("user",)
    search_fields = ("user__email",)
    readonly_fields = ("created_at",)
    ordering = ("-reported_at",)
