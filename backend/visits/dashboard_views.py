import logging

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Visit

logger = logging.getLogger(__name__)


class DashboardStatsView(APIView):
    """GET /api/dashboard/stats/ — visits_today, visits_this_month, active_officers. Admin & Supervisor only."""

    def get(self, request):
        if request.user.role not in ("admin", "supervisor"):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Dashboard is for admin and supervisor only.")
        user = request.user
        base_qs = Visit.objects.all()
        if user.role == "supervisor":
            # Supervisors see only stats for their department.
            if user.department_id:
                base_qs = base_qs.filter(officer__department=user.department)
            else:
                base_qs = base_qs.none()
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
