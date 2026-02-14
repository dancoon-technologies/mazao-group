import uuid
from django.db import models
from django.conf import settings
from farmers.models import Farmer


class Visit(models.Model):
    class VerificationStatus(models.TextChoices):
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="visits",
    )
    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name="visits")
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    photo = models.ImageField(upload_to="visits/%Y/%m/", blank=True)
    notes = models.TextField(blank=True)
    distance_from_farmer = models.FloatField(null=True, blank=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.VERIFIED,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.officer.email} @ {self.farmer.name} ({self.created_at})"
