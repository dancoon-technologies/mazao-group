"""
Location tracking API.
- POST (batch): mobile submits reports (offline-first sync). Auth required.
- GET: admin/supervisor list reports with filters. Supports poor network (small pages, etag optional).
"""

import logging
from datetime import date as date_type, datetime, time

from django.conf import settings
from django.utils import timezone as tz_util
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LocationReport
from .serializers import LocationReportCreateSerializer, LocationReportSerializer

logger = logging.getLogger(__name__)


def _parse_date_filter(value: str | None):
    """Parse YYYY-MM-DD to date, or None if invalid."""
    if not value or not isinstance(value, str):
        return None
    try:
        return date_type.fromisoformat(value.strip())
    except (ValueError, TypeError):
        return None


def _date_bounds(from_date, to_date):
    """
    Return (start_dt, end_dt) for filtering reported_at, in default timezone.
    Avoids __date lookup which can fail on SQLite/some backends.
    """
    if from_date is None and to_date is None:
        return None, None
    tz = tz_util.get_default_timezone() if settings.USE_TZ else None
    start_dt = None
    end_dt = None
    if from_date is not None:
        start_dt = datetime.combine(from_date, time.min)
        if tz:
            start_dt = tz_util.make_aware(start_dt, tz)
    if to_date is not None:
        end_dt = datetime.combine(to_date, time.max)
        if tz:
            end_dt = tz_util.make_aware(end_dt, tz)
    return start_dt, end_dt


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
            qs = LocationReport.objects.select_related("user").order_by("-reported_at")
            if request.user.role == "supervisor":
                if request.user.department_id:
                    qs = qs.filter(user__department=request.user.department)
                else:
                    qs = qs.none()
            user_id = request.query_params.get("user_id")
            if user_id:
                qs = qs.filter(user_id=user_id)
            from_date = _parse_date_filter(request.query_params.get("date_from"))
            to_date = _parse_date_filter(request.query_params.get("date_to"))
            start_dt, end_dt = _date_bounds(from_date, to_date)
            if start_dt is not None:
                qs = qs.filter(reported_at__gte=start_dt)
            if end_dt is not None:
                qs = qs.filter(reported_at__lte=end_dt)

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
            LocationReport.objects.create(
                user=request.user,
                reported_at=ser.validated_data["reported_at"],
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
