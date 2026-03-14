import logging

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from schedules.models import Schedule
from visits.models import Visit

from .serializers import ScheduleSyncSerializer, VisitSyncSerializer

logger = logging.getLogger(__name__)


class MobileSyncPushView(APIView):
    """
    Receive locally changed schedules from mobile (bulk upsert).
    Visits are not pushed here; mobile uploads them via POST /api/visits/ (multipart) when syncing.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        schedules_data = request.data.get("schedules", [])
        accepted = 0
        for record in schedules_data:
            # Only allow creating/updating schedules for the current user as officer
            if str(record.get("officer")) != str(request.user.pk):
                continue
            Schedule.objects.update_or_create(
                id=record["id"],
                defaults={
                    "officer_id": record["officer"],
                    "created_by_id": record.get("created_by") or request.user.pk,
                    "farmer_id": record.get("farmer"),
                    "farm_id": record.get("farm"),
                    "scheduled_date": record["scheduled_date"],
                    "notes": record.get("notes", ""),
                    "status": record.get("status", Schedule.Status.PROPOSED),
                    "updated_at": timezone.now(),
                },
            )
            accepted += 1
        logger.info(
            "POST /api/mobile-sync/push/ user=%s schedules_total=%s schedules_accepted=%s",
            request.user.id,
            len(schedules_data),
            accepted,
        )
        return Response({"status": "success"}, status=status.HTTP_200_OK)


class MobileSyncPullView(APIView):
    """
    Return visits and schedules for the current user.
    Officer: own visits and schedules. Supervisor: visits and schedules for officers in their department.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        last_sync = request.query_params.get("last_sync")
        last_sync_dt = parse_datetime(last_sync) if last_sync else None

        if request.user.role == "supervisor" and getattr(request.user, "department_id", None):
            visits_qs = (
                Visit.objects.filter(officer__department_id=request.user.department_id)
                .select_related("farmer", "farm", "schedule", "officer", "officer__department")
            )
            schedules_qs = (
                Schedule.objects.filter(officer__department_id=request.user.department_id)
                .select_related("farmer", "farm", "officer", "officer__department")
            )
        else:
            visits_qs = Visit.objects.filter(officer=request.user).select_related("farmer", "farm", "schedule")
            schedules_qs = Schedule.objects.filter(officer=request.user).select_related("farmer", "farm")

        if last_sync_dt:
            visits_qs = visits_qs.filter(updated_at__gt=last_sync_dt)
            schedules_qs = schedules_qs.filter(updated_at__gt=last_sync_dt)

        visits = VisitSyncSerializer(visits_qs, many=True).data
        schedules = ScheduleSyncSerializer(schedules_qs, many=True).data
        logger.info(
            "GET /api/mobile-sync/pull/ user=%s last_sync=%s visits=%s schedules=%s",
            request.user.id,
            last_sync,
            len(visits),
            len(schedules),
        )
        return Response(
            {
                "visits": visits,
                "schedules": schedules,
                "server_time": timezone.now().isoformat(),
            },
            status=status.HTTP_200_OK,
        )
