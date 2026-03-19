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
from typing import Any, Dict, Optional

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import Notification, PushDeliveryAttempt, PushToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _token_prefix(token: str) -> str:
    return (token or "")[:50]


def send_push_expo(
    tokens: list[str],
    title: str,
    body: str,
    user=None,
    notification=None,
    data: Optional[Dict[str, Any]] = None,
) -> None:
    """Send push notifications via Expo Push API. Logs errors and records each attempt if user is provided.

    Optional ``data`` is attached per Expo message (Android requires string values — we coerce).
    """
    if not tokens:
        return
    payload = []
    for token in tokens:
        entry: Dict[str, Any] = {
            "to": token,
            "title": title[:120],
            "body": (body or "")[:500],
            "sound": "default",
        }
        if data:
            extra = {}
            for k, v in data.items():
                if v is None:
                    continue
                extra[str(k)] = v if isinstance(v, str) else str(v)
            if extra:
                entry["data"] = extra
        payload.append(entry)
    record_attempts = user is not None
    try:
        body_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            EXPO_PUSH_URL,
            data=body_bytes,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode()
            # Expo returns 200 (all ok) or 207 (mixed); both include per-ticket status in body
            if resp.status not in (200, 207):
                logger.warning("Expo push failed status=%s body=%s", resp.status, resp_body[:500])
                if record_attempts:
                    for token in tokens:
                        PushDeliveryAttempt.objects.create(
                            user=user,
                            notification=notification,
                            token_prefix=_token_prefix(token),
                            status=PushDeliveryAttempt.Status.ERROR,
                            error_message=f"HTTP {resp.status}",
                        )
            else:
                data = json.loads(resp_body)
                tickets = (isinstance(data, dict) and data.get("data")) or []
                for i, token in enumerate(tokens):
                    ticket = tickets[i] if i < len(tickets) else {}
                    status = ticket.get("status") or "error"
                    is_ok = status == "ok"
                    if record_attempts:
                        PushDeliveryAttempt.objects.create(
                            user=user,
                            notification=notification,
                            token_prefix=_token_prefix(token),
                            status=PushDeliveryAttempt.Status.SUCCESS if is_ok else PushDeliveryAttempt.Status.ERROR,
                            error_message="" if is_ok else (ticket.get("message") or "Unknown error")[:255],
                            expo_ticket_id=(ticket.get("id") or "")[:100],
                        )
                    if not is_ok:
                        logger.warning(
                            "Expo push ticket error: %s (details=%s)",
                            ticket.get("message"),
                            ticket.get("details"),
                        )
    except Exception as e:
        logger.warning("Expo push request failed: %s", e)
        if record_attempts:
            err_msg = str(e)[:255]
            for token in tokens:
                PushDeliveryAttempt.objects.create(
                    user=user,
                    notification=notification,
                    token_prefix=_token_prefix(token),
                    status=PushDeliveryAttempt.Status.ERROR,
                    error_message=err_msg,
                )


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


def notify_user(user, title: str, message: str, channels=None, action_data=None):
    """
    Create in-app notification and optionally send email/SMS/push.
    channels: list of "in_app" | "email" | "sms" | "push" (default: ["in_app", "email", "sms", "push"]).
    action_data: optional dict stored on the in-app row and sent as Expo push ``data`` (deep links).
    """
    if channels is None:
        channels = ["in_app", "email", "sms", "push"]

    extra = action_data if isinstance(action_data, dict) else {}

    notification = None
    if "in_app" in channels:
        notification = Notification.objects.create(
            user=user,
            title=title,
            message=message,
            action_data=extra,
        )

    if "push" in channels:
        tokens = list(
            PushToken.objects.filter(user=user).values_list("token", flat=True)
        )
        if tokens:
            send_push_expo(
                tokens,
                title,
                message or "",
                user=user,
                notification=notification,
                data=extra or None,
            )

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
