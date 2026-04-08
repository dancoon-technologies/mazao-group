import uuid

from django.conf import settings
from django.db import models

from mobile_sync.models import MobileSyncModel


class Route(MobileSyncModel):
    class Status(models.TextChoices):
        PROPOSED = "proposed", "Proposed"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    """
    A route is one officer’s plan for a single calendar day (weekly plan: Mon–Sat).
    Multiple visits can reference the same route; customers are chosen when recording each visit.
    End-of-day RouteReport summarizes activity on that route.
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
        help_text="Default activity type slugs for visits on this route (can be overridden per visit).",
    )
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PROPOSED,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_routes",
    )
    rejection_reason = models.TextField(
        blank=True,
        default="",
    )
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


class RouteReport(models.Model):
    """
    End-of-day report for a route, grounded in farm activities actually carried out
    during that route (visits linked to the route and their activity types / extra fields).

    The officer completes it (e.g. after a reminder). It can be prefilled from those
    visits so the report reflects what was done at each customer, not a generic template.
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
