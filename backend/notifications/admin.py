from django.contrib import admin
from django.utils.html import format_html

from .models import Notification, PushDeliveryAttempt, PushToken


@admin.register(PushToken)
class PushTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "token_prefix", "device_id", "updated_at")
    list_filter = ()
    search_fields = ("user__email", "token", "device_id")
    raw_id_fields = ("user",)
    readonly_fields = ("id", "token", "created_at", "updated_at")

    def token_prefix(self, obj):
        return (obj.token or "")[:40] + "…" if len(obj.token or "") > 40 else (obj.token or "—")

    token_prefix.short_description = "Token"


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "created_at", "read_at", "archived_at")
    list_filter = ("archived_at", "read_at")
    search_fields = ("title", "message", "user__email")
    raw_id_fields = ("user",)
    readonly_fields = ("id", "created_at")


@admin.register(PushDeliveryAttempt)
class PushDeliveryAttemptAdmin(admin.ModelAdmin):
    list_display = ("sent_at", "user", "notification_short", "status", "error_message", "token_prefix")
    list_filter = ("status", "sent_at")
    search_fields = ("user__email", "error_message", "token_prefix")
    raw_id_fields = ("user", "notification")
    readonly_fields = ("id", "sent_at", "expo_ticket_id")
    date_hierarchy = "sent_at"
    ordering = ("-sent_at",)

    def notification_short(self, obj):
        if not obj.notification_id:
            return "—"
        n = obj.notification
        return format_html(
            '<a href="{}">{}</a>',
            f"/admin/notifications/notification/{n.id}/change/",
            (n.title or str(n.id))[:50],
        )

    notification_short.short_description = "Notification"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("user", "notification")

    def changelist_view(self, request, extra_context=None):
        # Default to showing only failed attempts when opening the list
        if "status__exact" not in request.GET and "all" not in request.GET:
            from django.http import HttpResponseRedirect
            from django.urls import reverse

            query = request.GET.copy()
            query["status__exact"] = PushDeliveryAttempt.Status.ERROR
            url = reverse("admin:notifications_pushdeliveryattempt_changelist")
            return HttpResponseRedirect(f"{url}?{query.urlencode()}")
        return super().changelist_view(request, extra_context)
