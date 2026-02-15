"""Account services: password generation, sending credentials email."""
import secrets
from django.conf import settings
from django.core.mail import send_mail


def generate_temporary_password(length: int = 8) -> str:
    """Generate a URL-safe temporary password."""
    return secrets.token_urlsafe(length)[:length]


def send_staff_credentials_email(
    email: str,
    temporary_password: str,
    name: str = "",
) -> None:
    """Send login credentials to a newly registered staff member."""
    login_url = getattr(
        settings,
        "FRONTEND_LOGIN_URL",
        "http://localhost:3000/login",
    ).rstrip("/")
    subject = "Your Mazao Portal login credentials"
    role_hint = "You have been registered as staff on the Mazao portal."
    body = f"""Hello{f' {name}' if name else ''},

{role_hint}

Your temporary login credentials:

  Email: {email}
  Temporary password: {temporary_password}

Sign in here: {login_url}

You will be required to set a new password after your first login.

Do not share this email. If you did not expect this, please contact your administrator.
"""
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@mazao.local")
    send_mail(
        subject=subject,
        message=body,
        from_email=from_email,
        recipient_list=[email],
        fail_silently=False,
    )


def resend_staff_credentials(user):
    """Generate a new temporary password, set it on the user, and email credentials. Admin only."""
    from .models import User

    if user.role not in (User.Role.SUPERVISOR, User.Role.OFFICER):
        raise ValueError("User is not staff (supervisor or officer).")
    temporary_password = generate_temporary_password()
    user.set_password(temporary_password)
    user.must_change_password = True
    user.save(update_fields=["password", "must_change_password"])
    send_staff_credentials_email(
        email=user.email,
        temporary_password=temporary_password,
        name=user.display_name or "",
    )
