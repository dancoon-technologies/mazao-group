"""Account services: password generation, sending credentials email."""

import secrets

from django.conf import settings

from config.mail_outbound import send_email


# Uppercase + digits only; omit 0/O, 1/I/L to reduce typos when staff type from email.
_TEMP_PASSWORD_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


def generate_temporary_password(length: int = 8) -> str:
    """Generate a random temporary password (short, easy to read; staff should change after login)."""
    if length < 6:
        length = 6
    return "".join(secrets.choice(_TEMP_PASSWORD_ALPHABET) for _ in range(length))


def send_staff_credentials_email(
    email: str,
    temporary_password: str,
    name: str = "",
) -> None:
    """Send login credentials to a newly registered staff member."""
    subject = "Your Mazao Portal login credentials"
    role_hint = "You have been registered as staff on the Mazao portal."
    body = f"""Hello{f" {name}" if name else ""},

{role_hint}

Your temporary login credentials:

  Email: {email}
  Temporary password: {temporary_password}

Do not share this email. If you did not expect this, please contact your administrator.
"""
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@mazao.local")
    send_email(
        subject=subject,
        message=body,
        recipient_list=[email],
        from_email=from_email,
        fail_silently=False,
    )


def resend_staff_credentials(user):
    """Generate a new temporary password, set it on the user, and email credentials. Admin only."""
    from .models import User

    if user.role not in (User.Role.SUPERVISOR, User.Role.OFFICER):
        raise ValueError("User is not staff (supervisor or officer).")
    temporary_password = generate_temporary_password()
    user.set_password(temporary_password)
    user.save(update_fields=["password"])
    send_staff_credentials_email(
        email=user.email,
        temporary_password=temporary_password,
        name=user.display_name or "",
    )
