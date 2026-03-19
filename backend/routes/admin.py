from django.contrib import admin
from .models import Route, RouteReport, RouteStop


class RouteStopInline(admin.TabularInline):
    model = RouteStop
    extra = 0
    raw_id_fields = ("farmer", "farm")


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ("officer", "scheduled_date", "name", "created_at")
    list_filter = ("scheduled_date",)
    raw_id_fields = ("officer",)
    inlines = [RouteStopInline]


@admin.register(RouteReport)
class RouteReportAdmin(admin.ModelAdmin):
    list_display = ("route", "submitted_at", "submitted_by")
    raw_id_fields = ("route", "submitted_by")
