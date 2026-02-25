import logging

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer

logger = logging.getLogger(__name__)


class NotificationListView(generics.ListAPIView):
    """List notifications for the current user."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(
            user=self.request.user,
            archived_at__isnull=True,
        )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        data = getattr(response, "data", None)
        count = len(data) if isinstance(data, list) else len(data.get("results", [])) if isinstance(data, dict) else 0
        logger.debug("GET /api/notifications/ user=%s count=%s", request.user.id, count)
        return response


class NotificationMarkReadView(generics.GenericAPIView):
    """Mark a notification as read."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        notification = Notification.objects.filter(
            user=request.user,
            pk=pk,
        ).first()
        if not notification:
            logger.debug("PATCH /api/notifications/%s/read not found user=%s", pk, request.user.id)
            return Response(
                {"detail": "Not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        from django.utils import timezone

        notification.read_at = timezone.now()
        notification.save(update_fields=["read_at"])
        logger.debug("PATCH /api/notifications/%s/read user=%s", pk, request.user.id)
        return Response(NotificationSerializer(notification).data)


class NotificationUnreadCountView(generics.GenericAPIView):
    """Get unread count (for badge)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(
            user=request.user,
            read_at__isnull=True,
            archived_at__isnull=True,
        ).count()
        logger.debug("GET /api/notifications/unread-count/ user=%s count=%s", request.user.id, count)
        return Response({"unread_count": count})


class NotificationMarkAllReadView(generics.GenericAPIView):
    """Mark all notifications as read for the current user."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.utils import timezone

        updated = Notification.objects.filter(
            user=request.user,
            read_at__isnull=True,
            archived_at__isnull=True,
        ).update(read_at=timezone.now())
        logger.debug("POST /api/notifications/mark-all-read/ user=%s marked=%s", request.user.id, updated)
        return Response({"marked_count": updated})


class NotificationArchiveView(generics.GenericAPIView):
    """Archive a notification (remove from list)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        notification = Notification.objects.filter(
            user=request.user,
            pk=pk,
            archived_at__isnull=True,
        ).first()
        if not notification:
            logger.debug("POST /api/notifications/%s/archive not found user=%s", pk, request.user.id)
            return Response(
                {"detail": "Not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        from django.utils import timezone

        notification.archived_at = timezone.now()
        notification.save(update_fields=["archived_at"])
        logger.debug("POST /api/notifications/%s/archive user=%s", pk, request.user.id)
        return Response(status=status.HTTP_204_NO_CONTENT)
