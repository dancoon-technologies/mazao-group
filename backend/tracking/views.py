"""
Location tracking API.
- GET /api/tracking/time/: server UTC for device clock sync (timestamp sync for route accuracy).
- POST (batch): mobile submits reports (offline-first sync). Auth required.
- GET: admin/supervisor list reports with filters. Supports poor network (small pages, etag optional).
  Date filtering: same as visits — date_from + date_to, or single date param (YYYY-MM-DD).
  Backend fraud detection: impossible travel (speed), mock_provider, integrity flags.
"""

import logging
from datetime import timedelta
from math import asin, cos, radians, sin, sqrt

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

# Speed above this (km/h) is flagged as impossible for ground travel (fraud detection).
IMPOSSIBLE_SPEED_KMH = 150


def _haversine_km(lat1, lon1, lat2, lon2):
    """Return distance in km between two (lat, lon) in decimal degrees."""
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, (float(lat1), float(lon1), float(lat2), float(lon2)))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(min(1, a)))
    return R * c


def _compute_speed_kmh(lat1, lon1, t1, lat2, lon2, t2):
    """Return speed in km/h between two points and timestamps. t1, t2 are timezone-aware datetimes."""
    if t1 is None or t2 is None or t1 >= t2:
        return None
    delta_hours = (t2 - t1).total_seconds() / 3600
    if delta_hours <= 0:
        return None
    km = _haversine_km(lat1, lon1, lat2, lon2)
    return km / delta_hours


def _server_integrity_warning(reported_at, reported_at_server, lat, lon, user, device_integrity):
    """
    Return integrity_warning string if server-side fraud checks fail: impossible travel,
    or client-reported mock_provider / impossible_speed.
    """
    if isinstance(device_integrity, dict):
        if device_integrity.get("mock_provider"):
            return "mock_provider"
        flags = device_integrity.get("integrity_flags") or []
        if "impossible_speed" in flags:
            return "impossible_speed"
    # Impossible travel: compare to chronologically previous report for this user
    t_curr = reported_at_server or reported_at
    prev = (
        LocationReport.objects.filter(user=user)
        .annotate(t=Coalesce(F("reported_at_server"), F("reported_at")))
        .filter(t__lt=t_curr)
        .order_by("-t")
        .first()
    )
    if prev is None:
        return None
    t_prev = prev.reported_at_server or prev.reported_at
    speed = _compute_speed_kmh(
        float(prev.latitude), float(prev.longitude), t_prev,
        float(lat), float(lon), t_curr,
    )
    if speed is not None and speed >= IMPOSSIBLE_SPEED_KMH:
        return "impossible_travel"
    return None


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
            device_integrity = ser.validated_data.get("device_integrity")
            integrity_warning = _server_integrity_warning(
                reported_at,
                reported_at_server,
                ser.validated_data["latitude"],
                ser.validated_data["longitude"],
                request.user,
                device_integrity,
            )
            if integrity_warning:
                logger.warning(
                    "Tracking integrity_warning user=%s report_index=%d warning=%s",
                    request.user.id, i, integrity_warning,
                )
            LocationReport.objects.create(
                user=request.user,
                reported_at=reported_at,
                reported_at_server=reported_at_server,
                latitude=ser.validated_data["latitude"],
                longitude=ser.validated_data["longitude"],
                accuracy=ser.validated_data.get("accuracy"),
                battery_percent=ser.validated_data.get("battery_percent"),
                device_info=ser.validated_data.get("device_info") or {},
                device_integrity=device_integrity,
                integrity_warning=integrity_warning,
            )
            created += 1
        if errors and created == 0:
            return Response({"detail": "Validation failed.", "errors": errors}, status=status.HTTP_400_BAD_REQUEST)
        logger.info("Location reports batch: user=%s created=%d errors=%d", request.user.id, created, len(errors))
        return Response({"created": created, "errors": errors}, status=status.HTTP_201_CREATED)
