from django.contrib import admin
from .models import Schedule


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ("officer", "scheduled_date", "farmer", "created_by", "created_at")
    list_filter = ("scheduled_date",)
    raw_id_fields = ("created_by", "officer", "farmer")
