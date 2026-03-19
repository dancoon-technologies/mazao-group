import uuid

from django.conf import settings
from django.db import models

from farmers.models import Farm, Farmer
from mobile_sync.models import MobileSyncModel


class Route(MobileSyncModel):
    """
    A route is a day plan for an officer: a collection of stops (farmers/stockists + locations)
    to be visited in a single day. Same activities and same officer for the whole route.
    Used for weekly plan: Mon–Sat routes.

    Visits recorded against this route capture farm-level activities; the end-of-day
    RouteReport summarizes what was done at those farms along the route.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="routes",
        limit_choices_to={"role": "officer"},
    )
    scheduled_date = models.DateField(help_text="Day this route is planned for (e.g. Monday).")
    name = models.CharField(
        max_length=120,
        blank=True,
        help_text="Optional label e.g. 'Eastern circuit', 'Nairobi stockists'.",
    )
    activity_types = models.JSONField(
        default=list,
        blank=True,
        help_text="List of activity type slugs for this route (same for all stops).",
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-scheduled_date", "-created_at"]
        indexes = [
            models.Index(fields=["officer", "-scheduled_date"], name="route_officer_date"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["officer", "scheduled_date"],
                name="route_officer_date_unique",
            )
        ]

    def __str__(self):
        parts = [str(self.officer.email), self.scheduled_date.isoformat()]
        if self.name:
            parts.append(self.name)
        return " | ".join(parts)


class RouteStop(MobileSyncModel):
    """One stop on a route: farmer/stockist + optional farm/outlet, with display order."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route = models.ForeignKey(
        Route,
        on_delete=models.CASCADE,
        related_name="stops",
    )
    farmer = models.ForeignKey(
        Farmer,
        on_delete=models.CASCADE,
        related_name="route_stops",
    )
    farm = models.ForeignKey(
        Farm,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="route_stops",
        help_text="Optional specific farm/outlet for this stop.",
    )
    order = models.PositiveSmallIntegerField(
        default=0,
        help_text="Order of this stop in the route (0 = first).",
    )

    class Meta:
        ordering = ["route", "order", "id"]
        indexes = [
            models.Index(fields=["route"], name="routestop_route_id"),
        ]

    def __str__(self):
        return f"{self.route} — stop {self.order}: {self.farmer.name}"


class RouteReport(models.Model):
    """
    End-of-day report for a route, grounded in farm activities actually carried out
    during that route (visits linked to the route and their activity types / extra fields).

    The officer completes it (e.g. after a reminder). It can be prefilled from those
    visits so the report reflects what was done at each farm stop, not a generic template.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route = models.OneToOneField(
        Route,
        on_delete=models.CASCADE,
        related_name="report",
        help_text="The route this report describes; content should align with visits/activities on that route.",
    )
    report_data = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Structured report content derived from or summarizing farm activities "
            "recorded on visits during this route (e.g. aggregates, narrative summary)."
        ),
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_route_reports",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Report for {self.route}"
