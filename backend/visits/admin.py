from django.contrib import admin

from .models import ActivityTypeConfig, Visit


@admin.register(ActivityTypeConfig)
class ActivityTypeConfigAdmin(admin.ModelAdmin):
    list_display = ("value", "label", "order", "departments_display")
    list_editable = ("order",)
    list_filter = ("departments",)
    search_fields = ("value", "label")
    filter_horizontal = ("departments",)

    def departments_display(self, obj):
        if not obj.departments.exists():
            return "All departments"
        return ", ".join(d.name for d in obj.departments.all())

    departments_display.short_description = "Departments"


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = (
        "officer",
        "farmer",
        "verification_status",
        "distance_from_farmer",
        "created_at",
    )
    list_filter = ("verification_status", "created_at")
    raw_id_fields = ("officer", "farmer")
    readonly_fields = ("created_at",)
