from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Department, User


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("slug", "name")
    search_fields = ("slug", "name")


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        "email",
        "first_name",
        "middle_name",
        "last_name",
        "role",
        "department",
        "get_region_display",
        "is_active",
    )
    list_filter = ("role", "department", "is_active")
    search_fields = ("email", "first_name", "last_name")
    ordering = ("email",)
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Profile",
            {
                "fields": (
                    "first_name",
                    "middle_name",
                    "last_name",
                    "phone",
                    "role",
                    "department",
                    "region_id",
                    "county_id",
                    "sub_county_id",
                    "device_id",
                    "must_change_password",
                )
            },
        ),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),
        (
            "Profile",
            {
                "fields": (
                    "first_name",
                    "middle_name",
                    "last_name",
                    "phone",
                    "role",
                    "department",
                    "region_id",
                    "county_id",
                    "sub_county_id",
                )
            },
        ),
    )
