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
        default=1,
        help_text="Minutes between location reports during working hours (e.g. 1 = every minute).",
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
        verbose_name="Captured (device time)",
        help_text="Device time when the location was captured by the phone (even when offline; synced later).",
    )
    reported_at_server = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Captured (server-corrected)",
        help_text="reported_at minus device_clock_offset when provided; used for route ordering.",
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
    device_integrity = models.JSONField(
        null=True,
        blank=True,
        help_text="Client-side integrity: mock_provider, rooted, speed_kmh, integrity_flags.",
    )
    integrity_warning = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        help_text="Server-side fraud flag e.g. impossible_travel, mock_provider.",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Received (server)",
        help_text="When the server saved this record (can be later than capture if synced from offline).",
    )

    class Meta:
        ordering = ["-reported_at"]
        indexes = [
            models.Index(fields=["user", "-reported_at"], name="track_report_user_time"),
            models.Index(fields=["-reported_at"], name="track_report_time"),
        ]

    def __str__(self):
        return f"{self.user.email} @ {self.reported_at}"
