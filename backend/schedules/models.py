import uuid
from django.db import models
from django.conf import settings
from farmers.models import Farmer


class Schedule(models.Model):
    """Visit schedule: officer proposes, supervisor/admin accepts or rejects."""

    class Status(models.TextChoices):
        PROPOSED = "proposed", "Proposed"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_schedules",
    )
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="schedules",
        limit_choices_to={"role": "officer"},
    )
    farmer = models.ForeignKey(
        Farmer,
        on_delete=models.CASCADE,
        related_name="schedules",
        null=True,
        blank=True,
    )
    scheduled_date = models.DateField()
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
        related_name="approved_schedules",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-scheduled_date", "-created_at"]
        indexes = [
            models.Index(fields=["officer", "-scheduled_date"], name="sched_officer_date"),
        ]

    def __str__(self):
        parts = [str(self.officer.email), self.scheduled_date.isoformat()]
        if self.farmer:
            parts.append(str(self.farmer.name))
        return " | ".join(parts)
