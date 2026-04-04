from django.contrib import admin

from .models import Route, RouteReport


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ("officer", "scheduled_date", "name", "created_at")
    list_filter = ("scheduled_date",)
    raw_id_fields = ("officer",)


@admin.register(RouteReport)
class RouteReportAdmin(admin.ModelAdmin):
    list_display = ("route", "submitted_at", "submitted_by")
    raw_id_fields = ("route", "submitted_by")
