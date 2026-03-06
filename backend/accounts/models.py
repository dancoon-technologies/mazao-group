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


class Department(models.Model):
    """Department (e.g. Mazao na afya, Agritech). Linked from ActivityTypeConfig and optionally from User."""

    slug = models.SlugField(max_length=30, unique=True)
    name = models.CharField(max_length=80)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class User(AbstractUser):
    """Custom user: email as identifier, role, department, location (region_id/county_id/sub_county_id), device_id."""

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
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )
    region_id = models.ForeignKey(
        "locations.Region",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        db_column="region_id",
    )
    county_id = models.ForeignKey(
        "locations.County",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        db_column="county_id",
    )
    sub_county_id = models.ForeignKey(
        "locations.SubCounty",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        db_column="sub_county_id",
    )
    device_id = models.CharField(max_length=128, blank=True)
    must_change_password = models.BooleanField(default=False)
    # Single device: only the refresh token with this jti is valid (enforces one login at a time).
    current_refresh_jti = models.CharField(max_length=255, blank=True, editable=False)

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

    def same_region_as(self, other):
        """True if this user is in the same region as other (for scoping)."""
        a = getattr(self, "region_id_id", None)
        b = getattr(other, "region_id_id", None)
        return a is not None and b is not None and a == b

    def get_region_display(self):
        """For admin/list display: region name from location."""
        if self.region_id_id and getattr(self, "region_id", None):
            return self.region_id.name
        return ""

    get_region_display.short_description = "Region"

    def get_department_display(self):
        """Department name for display (e.g. in JWT, admin)."""
        return self.department.name if self.department else ""

    get_department_display.short_description = "Department"
