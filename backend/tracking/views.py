"""
Location tracking API.
- POST (batch): mobile submits reports (offline-first sync). Auth required.
- GET: admin/supervisor list reports with filters. Supports poor network (small pages, etag optional).
"""

import logging
from datetime import date as date_type, datetime, time

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LocationReport
from .serializers import LocationReportCreateSerializer, LocationReportSerializer

logger = logging.getLogger(__name__)


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
            date_from = request.query_params.get("date_from")
            date_to = request.query_params.get("date_to")
            if date_from:
                try:
                    from_date = date_type.fromisoformat(date_from)
                    from_dt = timezone.make_aware(datetime.combine(from_date, time.min))
                    qs = qs.filter(reported_at__gte=from_dt)
                except (ValueError, TypeError):
                    pass
            if date_to:
                try:
                    to_date = date_type.fromisoformat(date_to)
                    to_dt = timezone.make_aware(datetime.combine(to_date, time.max))
                    qs = qs.filter(reported_at__lte=to_dt)
                except (ValueError, TypeError):
                    pass

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
