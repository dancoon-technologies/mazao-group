"""
SMS backends: console (log) for dev; Twilio for production when configured.
"""
import logging

logger = logging.getLogger(__name__)


class BaseSMSBackend:
    def send(self, phone: str, message: str) -> bool:
        raise NotImplementedError


class ConsoleSMSBackend(BaseSMSBackend):
    """Log SMS to console (for development)."""

    def send(self, phone: str, message: str) -> bool:
        logger.info("[SMS to %s] %s", phone, message[:200])
        print(f"[SMS to {phone}] {message[:200]}")  # noqa: T201
        return True


class TwilioSMSBackend(BaseSMSBackend):
    """Send SMS via Twilio. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER."""

    def send(self, phone: str, message: str) -> bool:
        from django.conf import settings
        account_sid = getattr(settings, "TWILIO_ACCOUNT_SID", None)
        auth_token = getattr(settings, "TWILIO_AUTH_TOKEN", None)
        from_number = getattr(settings, "TWILIO_FROM_NUMBER", None)
        if not all([account_sid, auth_token, from_number]):
            logger.warning("Twilio not configured; skipping SMS")
            return False
        try:
            from twilio.rest import Client
            client = Client(account_sid, auth_token)
            client.messages.create(body=message[:1600], from_=from_number, to=phone)
            return True
        except Exception as e:
            logger.exception("Twilio SMS failed: %s", e)
            return False
