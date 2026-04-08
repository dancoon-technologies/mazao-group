from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import ngettext

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
        "device_status",
        "is_active",
    )
    list_filter = ("role", "department", "is_active")
    search_fields = ("email", "first_name", "last_name")
    ordering = ("email",)
    readonly_fields = ("current_refresh_jti", "current_access_jti")
    actions = ("reset_device_bindings",)
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
                    "current_refresh_jti",
                    "current_access_jti",
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

    @admin.display(description="Device")
    def device_status(self, obj: User):
        return "Registered" if (obj.device_id or "").strip() else "Not registered"

    @admin.action(description="Reset selected device bindings")
    def reset_device_bindings(self, request, queryset):
        updated = queryset.update(
            device_id="",
            current_access_jti="",
            current_refresh_jti="",
        )
        self.message_user(
            request,
            ngettext(
                "%d user device binding was reset.",
                "%d user device bindings were reset.",
                updated,
            )
            % updated,
        )
