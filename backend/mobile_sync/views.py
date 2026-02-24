from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from schedules.models import Schedule
from visits.models import Visit

from .serializers import ScheduleSyncSerializer, VisitSyncSerializer


class MobileSyncPushView(APIView):
    """
    Receive locally changed visits and schedules from mobile.
    """

    def post(self, request):
        visits_data = request.data.get('visits', [])
        schedules_data = request.data.get('schedules', [])

        # Process Visits
        for record in visits_data:
            obj, _ = Visit.objects.update_or_create(
                id=record['id'],
                defaults=record
            )

        # Process Schedules
        for record in schedules_data:
            obj, _ = Schedule.objects.update_or_create(
                id=record['id'],
                defaults=record
            )

        return Response({"status": "success"}, status=status.HTTP_200_OK)


class MobileSyncPullView(APIView):
    """
    Return visits and schedules updated after `last_sync` timestamp.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        last_sync = request.query_params.get('last_sync')
        last_sync_dt = parse_datetime(last_sync) if last_sync else None

        visits_qs = Visit.objects.all()
        schedules_qs = Schedule.objects.all()

        if last_sync_dt:
            visits_qs = visits_qs.filter(updated_at__gt=last_sync_dt)
            schedules_qs = schedules_qs.filter(updated_at__gt=last_sync_dt)

        visits = VisitSyncSerializer(visits_qs, many=True).data
        schedules = ScheduleSyncSerializer(schedules_qs, many=True).data

        return Response({
            "visits": visits,
            "schedules": schedules,
            "server_time": timezone.now()
        }, status=status.HTTP_200_OK)
