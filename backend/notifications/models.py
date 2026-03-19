import uuid

from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models

MESSAGE_MAX_LENGTH = 2000


class PushToken(models.Model):
    """Expo push token for a user/device. One user can have multiple devices."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="push_tokens",
    )
    token = models.CharField(max_length=256, unique=True)
    device_id = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["user"], name="pushtoken_user_idx"),
        ]

    def __str__(self):
        return f"PushToken for {self.user_id}"


class Notification(models.Model):
    """In-app notification; email/sms sent at creation time and tracked optionally."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    title = models.CharField(max_length=120)
    message = models.TextField(validators=[MaxLengthValidator(MESSAGE_MAX_LENGTH)])
    action_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Deep-link payload for mobile (e.g. screen + ids). Mirrored on push; use string values.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    sms_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "archived_at"], name="notif_user_archived"),
        ]

    def __str__(self):
        return f"{self.title} for {self.user_id}"


class PushDeliveryAttempt(models.Model):
    """One record per push send (per token). Used to show failed notifications in admin."""

    class Status(models.TextChoices):
        SUCCESS = "success", "Success"
        ERROR = "error", "Error"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="push_delivery_attempts",
    )
    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="push_attempts",
    )
    token_prefix = models.CharField(max_length=50, help_text="First part of Expo token for debugging")
    sent_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=Status.choices)
    error_message = models.CharField(max_length=255, blank=True)
    expo_ticket_id = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["-sent_at"]
        indexes = [
            models.Index(fields=["status"], name="pushattempt_status_idx"),
            models.Index(fields=["user", "sent_at"], name="pushattempt_user_sent_idx"),
        ]

    def __str__(self):
        return f"Push {self.status} to {self.user_id} at {self.sent_at}"
