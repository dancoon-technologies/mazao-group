"""
Admin-editable environment config. Avoids rebuilding apps when changing per-env settings.
Values are returned in GET /api/options/ and used by backend validation.
Fallback: Django settings (env) when no row exists.
"""

from django.db import models


class SiteConfig(models.Model):
    """
    Singleton-style config (one row). Edit in admin to change behaviour without redeploy.
    Used for visit validation, mobile options, etc.
    """
    # Visit / GPS
    visit_max_distance_meters = models.PositiveIntegerField(
        default=100,
        help_text="Max distance (m) from farmer/farm to accept a visit. Increase for dev/testing.",
    )
    visit_warning_distance_meters = models.PositiveIntegerField(
        default=80,
        help_text="Distance (m) at which mobile app shows a warning before user is over limit.",
    )
    visit_travel_validation_window_hours = models.FloatField(
        default=12.0,
        help_text="Only check travel speed if previous visit was within this many hours.",
    )
    visit_max_travel_speed_kmh = models.FloatField(
        default=120.0,
        help_text="Max reasonable speed (km/h) between consecutive visits; reject if exceeded.",
    )
    visit_photo_max_size_mb = models.PositiveSmallIntegerField(
        default=5,
        help_text="Max visit photo size in MB.",
    )

    class Meta:
        verbose_name = "Site config"
        verbose_name_plural = "Site config"

    def __str__(self):
        return "Site config (visit & app settings)"
