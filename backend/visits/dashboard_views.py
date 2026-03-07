import logging
from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Visit

logger = logging.getLogger(__name__)


def _get_base_queryset(request):
    """Shared base queryset for dashboard: all visits, filtered by department for supervisors."""
    if request.user.role not in ("admin", "supervisor"):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("Dashboard is for admin and supervisor only.")
    user = request.user
    base_qs = Visit.objects.all()
    if user.role == "supervisor":
        if user.department_id:
            base_qs = base_qs.filter(officer__department=user.department)
        else:
            base_qs = base_qs.none()
    return base_qs


class DashboardStatsView(APIView):
    """GET /api/dashboard/stats/ — visits_today, visits_this_month, active_officers. Admin & Supervisor only."""

    def get(self, request):
        base_qs = _get_base_queryset(request)
        user = request.user
        today = timezone.now().date()
        start_of_month = today.replace(day=1)
        stats = base_qs.aggregate(
            visits_today=Count("id", filter=Q(created_at__date=today)),
            visits_this_month=Count("id", filter=Q(created_at__date__gte=start_of_month)),
        )
        active_officers = base_qs.values("officer").distinct().count()
        payload = {
            "visits_today": stats["visits_today"] or 0,
            "visits_this_month": stats["visits_this_month"] or 0,
            "active_officers": active_officers,
        }
        logger.info("GET /api/dashboard/stats/ user=%s role=%s %s", user.id, user.role, payload)
        return Response(payload)


class DashboardVisitsByDayView(APIView):
    """GET /api/dashboard/visits-by-day/?days=14 — list of { date, count } for charts. Admin & Supervisor only."""

    def get(self, request):
        base_qs = _get_base_queryset(request)
        try:
            days = min(90, max(7, int(request.GET.get("days", 14))))
        except ValueError:
            days = 14
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days - 1)
        qs = (
            base_qs.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
            .annotate(date=TruncDate("created_at"))
            .values("date")
            .annotate(count=Count("id"))
            .order_by("date")
        )
        count_by_date = {item["date"].isoformat(): item["count"] for item in qs}
        result = []
        for i in range(days):
            d = start_date + timedelta(days=i)
            key = d.isoformat()
            result.append({"date": key, "count": count_by_date.get(key, 0)})
        return Response(result)
