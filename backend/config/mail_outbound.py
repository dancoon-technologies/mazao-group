"""
Send transactional email via the Next.js internal mail API (Nodemailer),
with fallback to Django's configured SMTP (EMAIL_BACKEND / send_mail).
"""

from __future__ import annotations

import logging
from typing import List, Optional

import requests
from django.conf import settings
from django.core.mail import send_mail as django_send_mail

logger = logging.getLogger(__name__)


def send_email(
    subject: str,
    message: str,
    recipient_list: List[str],
    *,
    from_email: Optional[str] = None,
    html_message: Optional[str] = None,
    fail_silently: bool = False,
) -> None:
    """
    Deliver email: if WEB_MAIL_API_URL and WEB_MAIL_INTERNAL_SECRET are set, POST to the web app;
    otherwise (or on failure) use Django send_mail.
    """
    url = (getattr(settings, "WEB_MAIL_API_URL", "") or "").strip()
    secret = (getattr(settings, "WEB_MAIL_INTERNAL_SECRET", "") or "").strip()
    timeout = int(getattr(settings, "WEB_MAIL_REQUEST_TIMEOUT", 30))
    from_addr = from_email or getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@localhost")

    if url and secret and recipient_list:
        payload = {
            "to": recipient_list if len(recipient_list) > 1 else recipient_list[0],
            "subject": subject,
            "text": message,
            "from": from_addr,
        }
        if html_message:
            payload["html"] = html_message
        try:
            resp = requests.post(
                url.rstrip("/"),
                json=payload,
                headers={
                    "Authorization": f"Bearer {secret}",
                    "Content-Type": "application/json",
                },
                timeout=timeout,
            )
            if resp.status_code < 400:
                logger.info(
                    "Mail sent via web API status=%s recipients=%s",
                    resp.status_code,
                    recipient_list,
                )
                return
            logger.warning(
                "Web mail API returned %s: %s",
                resp.status_code,
                (resp.text or "")[:500],
            )
            logger.info(
                "Falling back to Django send_mail. If you intend to send via the web app, "
                "set SMTP_HOST, SMTP_USER, and SMTP_PASS on the Next.js server environment "
                "(Nodemailer runs in /api/internal/mail, not in the browser)."
            )
        except Exception as e:
            logger.warning("Web mail API request failed: %s", e)
            logger.info(
                "Falling back to Django send_mail after web mail transport error."
            )

    django_send_mail(
        subject=subject,
        message=message,
        from_email=from_addr,
        recipient_list=recipient_list,
        fail_silently=fail_silently,
        html_message=html_message,
    )
