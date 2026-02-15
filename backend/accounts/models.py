import uuid
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", self.model.Role.ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Custom user: email as identifier, role, region, device_id."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        SUPERVISOR = "supervisor", "Supervisor"
        OFFICER = "officer", "Extension Officer"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField("email", unique=True)
    middle_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.OFFICER)
    region = models.CharField(max_length=255, blank=True)
    device_id = models.CharField(max_length=255, blank=True)
    must_change_password = models.BooleanField(default=False)

    USERNAME_FIELD = "email"

    @property
    def display_name(self):
        """First, middle, last name combined."""
        parts = [p for p in (self.first_name, self.middle_name, self.last_name) if p]
        return " ".join(parts) if parts else ""

    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email
