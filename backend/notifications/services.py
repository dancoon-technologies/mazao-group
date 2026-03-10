"""
Send notifications via in-app (DB), email, SMS, and push (Expo).

Best practices:
- Always create in_app first so the user has a record even if email/SMS fail.
- Choose channels per event: in_app for everything; add email/sms/push only when
  the user needs to be alerted outside the app (e.g. schedule assigned, visit recorded).
- Email/SMS run synchronously; for high volume consider moving to a task queue
  (e.g. Celery) and call notify_user(..., channels=["in_app"]) then enqueue email/sms.
- Keep message text short for SMS (e.g. under 160 chars if single segment).
"""

import json
import logging
import urllib.request

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import Notification, PushToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_push_expo(tokens: list[str], title: str, body: str) -> None:
    """Send push notifications via Expo Push API. Fire-and-forget; logs errors."""
    if not tokens:
        return
    payload = [
        {"to": token, "title": title[:120], "body": (body or "")[:500], "sound": "default"}
        for token in tokens
    ]
    try:
        body_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            EXPO_PUSH_URL,
            data=body_bytes,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                logger.warning("Expo push failed status=%s", resp.status)
            else:
                data = json.loads(resp.read().decode())
                if isinstance(data, dict) and data.get("data"):
                    for ticket in data.get("data") or []:
                        if ticket.get("status") == "error":
                            logger.warning("Expo push ticket error: %s", ticket.get("message"))
    except Exception as e:
        logger.warning("Expo push request failed: %s", e)


def send_sms(phone: str, message: str) -> bool:
    """Send SMS. Uses Twilio if configured, else logs to console (DEBUG)."""
    phone = (phone or "").strip()
    if not phone:
        return False
    backend = getattr(
        settings,
        "NOTIFICATION_SMS_BACKEND",
        "notifications.sms_backends.ConsoleSMSBackend",
    )
    try:
        from django.utils.module_loading import import_string

        klass = import_string(backend)
        return klass().send(phone, message)
    except Exception:
        return False


def notify_user(user, title: str, message: str, channels=None):
    """
    Create in-app notification and optionally send email/SMS/push.
    channels: list of "in_app" | "email" | "sms" | "push" (default: ["in_app", "email", "sms", "push"]).
    """
    if channels is None:
        channels = ["in_app", "email", "sms", "push"]

    notification = None
    if "in_app" in channels:
        notification = Notification.objects.create(
            user=user,
            title=title,
            message=message,
        )

    if "push" in channels:
        tokens = list(
            PushToken.objects.filter(user=user).values_list("token", flat=True)
        )
        if tokens:
            send_push_expo(tokens, title, message or "")

    if "email" in channels and user.email:
        try:
            from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@mazao.local")
            send_mail(
                subject=title,
                message=message,
                from_email=from_email,
                recipient_list=[user.email],
                fail_silently=True,
            )
            if notification:
                notification.email_sent_at = timezone.now()
                notification.save(update_fields=["email_sent_at"])
        except Exception:
            pass

    if "sms" in channels and user.phone:
        try:
            if send_sms(user.phone, f"{title}\n\n{message}"):
                if notification:
                    notification.sms_sent_at = timezone.now()
                    notification.save(update_fields=["sms_sent_at"])
        except Exception:
            pass

    return notification
