"""
Location tracking API.
- GET /api/tracking/time/: server UTC for device clock sync (timestamp sync for route accuracy).
- POST (batch): mobile submits reports (offline-first sync). Auth required.
- GET: admin/supervisor list reports with filters. Supports poor network (small pages, etag optional).
  Date filtering: same as visits — date_from + date_to, or single date param (YYYY-MM-DD).
"""

import logging
from datetime import timedelta

from django.db.models import F
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LocationReport
from .serializers import LocationReportCreateSerializer, LocationReportSerializer

logger = logging.getLogger(__name__)


class ServerTimeView(APIView):
    """
    GET: Return server UTC time (ISO 8601). Used by mobile to compute device_clock_offset
    for timestamp sync and accurate route ordering. Auth required.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"utc": timezone.now().isoformat()})


def _can_list_reports(user):
    return user.role in ("admin", "supervisor")


class LocationReportListCreateView(APIView):
    """
    GET: List location reports. Admin: all users. Supervisor: officers in same department.
    Query params: user_id, date_from, date_to, page_size (default 200, max 500).
    Offline-first friendly: paginate by reported_at, small default page.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _can_list_reports(request.user):
            return Response({"detail": "Only admin or supervisor can list reports."}, status=status.HTTP_403_FORBIDDEN)

        try:
            # Prefer server-corrected time when available for consistent route ordering
            qs = LocationReport.objects.select_related("user").order_by(
                Coalesce(F("reported_at_server"), F("reported_at")).desc()
            )
            if request.user.role == "supervisor":
                if request.user.department_id:
                    qs = qs.filter(user__department=request.user.department)
                else:
                    qs = qs.none()
            user_id = request.query_params.get("user_id")
            if user_id:
                qs = qs.filter(user_id=user_id)
            date_str = request.query_params.get("date")
            date_from = request.query_params.get("date_from")
            date_to = request.query_params.get("date_to")
            if date_from and date_to:
                qs = qs.filter(
                    reported_at__date__gte=date_from,
                    reported_at__date__lte=date_to,
                )
            elif date_str:
                qs = qs.filter(reported_at__date=date_str)

            try:
                page_size = int(request.query_params.get("page_size", 200))
            except (TypeError, ValueError):
                page_size = 200
            page_size = min(500, max(1, page_size))
            reports = list(qs[:page_size])
            data = LocationReportSerializer(reports, many=True).data
            return Response({"results": data, "count": len(data)})
        except Exception as e:
            logger.exception("GET /api/tracking/reports/ error: %s", e)
            return Response(
                {"detail": "Failed to load tracking reports. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class LocationReportBatchCreateView(APIView):
    """
    POST: Create multiple location reports (offline-first batch sync).
    Body: { "reports": [ { "reported_at", "latitude", "longitude", "accuracy?", "battery_percent?", "device_info?" }, ... ] }
    All reports are attributed to the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        payload = request.data
        reports_data = payload.get("reports")
        if not isinstance(reports_data, list):
            return Response(
                {"detail": "Missing or invalid 'reports' array."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Limit batch size to avoid abuse and timeouts on poor network
        max_batch = 200
        if len(reports_data) > max_batch:
            return Response(
                {"detail": f"Maximum {max_batch} reports per request."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        created = 0
        errors = []
        for i, item in enumerate(reports_data):
            ser = LocationReportCreateSerializer(data=item)
            if not ser.is_valid():
                errors.append({"index": i, "errors": ser.errors})
                continue
            reported_at = ser.validated_data["reported_at"]
            offset_sec = ser.validated_data.get("device_clock_offset_seconds")
            reported_at_server = None
            if offset_sec is not None:
                reported_at_server = reported_at - timedelta(seconds=float(offset_sec))
            LocationReport.objects.create(
                user=request.user,
                reported_at=reported_at,
                reported_at_server=reported_at_server,
                latitude=ser.validated_data["latitude"],
                longitude=ser.validated_data["longitude"],
                accuracy=ser.validated_data.get("accuracy"),
                battery_percent=ser.validated_data.get("battery_percent"),
                device_info=ser.validated_data.get("device_info") or {},
            )
            created += 1
        if errors and created == 0:
            return Response({"detail": "Validation failed.", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)
        logger.info("Location reports batch: user=%s created=%d errors=%d", request.user.id, created, len(errors))
        return Response({"created": created, "errors": errors}, status=status.HTTP_201_CREATED)
