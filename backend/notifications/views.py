from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    """List notifications for the current user."""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(
            user=self.request.user,
            archived_at__isnull=True,
        )


class NotificationMarkReadView(generics.GenericAPIView):
    """Mark a notification as read."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        notification = Notification.objects.filter(
            user=request.user,
            pk=pk,
        ).first()
        if not notification:
            return Response(
                {"detail": "Not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        from django.utils import timezone
        notification.read_at = timezone.now()
        notification.save(update_fields=["read_at"])
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
            return Response(
                {"detail": "Not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        from django.utils import timezone
        notification.archived_at = timezone.now()
        notification.save(update_fields=["archived_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
