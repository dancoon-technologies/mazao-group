"""
Location reports from mobile during working hours.
Offline-first: mobile stores locally and syncs in batch when online.
"""

from django.conf import settings
from django.db import models


class TrackingSettings(models.Model):
    """
    Singleton-style config for location tracking (admin-editable).
    Working hours: local hour (0–23) when tracking is active. One row per deployment.
    """
    working_hour_start = models.PositiveSmallIntegerField(
        default=6,
        help_text="Start of working hours (0–23). Mobile collects location from this hour inclusive.",
    )
    working_hour_end = models.PositiveSmallIntegerField(
        default=18,
        help_text="End of working hours (0–23). Mobile collects until this hour exclusive.",
    )
    interval_minutes = models.PositiveSmallIntegerField(
        default=10,
        help_text="Minutes between location reports during working hours (e.g. 10 = every 10 min).",
    )

    class Meta:
        verbose_name = "Tracking settings"
        verbose_name_plural = "Tracking settings"

    def __str__(self):
        return f"Tracking {self.working_hour_start}:00–{self.working_hour_end}:00 every {self.interval_minutes} min"


class LocationReport(models.Model):
    """
    One GPS snapshot from a user (officer/supervisor) with optional battery and device info.
    Reported at can be device time; server stores received_at for sync order.
    """

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="location_reports",
    )
    reported_at = models.DateTimeField(
        help_text="Device timestamp when the location was captured (ISO from mobile).",
    )
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    accuracy = models.FloatField(
        null=True,
        blank=True,
        help_text="Accuracy radius in meters if provided by device.",
    )
    battery_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Device battery level 0–100 at time of report.",
    )
    device_info = models.JSONField(
        default=dict,
        blank=True,
        help_text="Device model, OS, app version, etc.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-reported_at"]
        indexes = [
            models.Index(fields=["user", "-reported_at"], name="track_report_user_time"),
            models.Index(fields=["-reported_at"], name="track_report_time"),
        ]

    def __str__(self):
        return f"{self.user.email} @ {self.reported_at}"
