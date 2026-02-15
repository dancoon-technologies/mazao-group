import uuid
from django.db import models
from django.conf import settings


class Farmer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=30, blank=True)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=50, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    crop_type = models.CharField(max_length=100, blank=True)
    assigned_officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_farmers",
        limit_choices_to={"role": "officer"},
    )
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def name(self):
        """Display name: Title First Middle Last (for backwards compatibility)."""
        parts = [p for p in (self.title, self.first_name, self.middle_name, self.last_name) if p]
        return " ".join(parts) if parts else ""

    def __str__(self):
        return self.name
