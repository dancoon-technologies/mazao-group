from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Visit


class DashboardStatsView(APIView):
    """GET /api/dashboard/stats/ — visits_today, visits_this_month, active_officers. Admin & Supervisor only."""

    def get(self, request):
        if request.user.role not in ("admin", "supervisor"):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Dashboard is for admin and supervisor only.")
        user = request.user
        base_qs = Visit.objects.all()
        if user.role == "supervisor":
            if getattr(user, "department", None):
                base_qs = base_qs.filter(officer__department=user.department)
            else:
                if getattr(user, "region_id_id", None):
                    base_qs = base_qs.filter(officer__region_id_id=user.region_id_id)
        today = timezone.now().date()
        start_of_month = today.replace(day=1)
        stats = base_qs.aggregate(
            visits_today=Count("id", filter=Q(created_at__date=today)),
            visits_this_month=Count("id", filter=Q(created_at__date__gte=start_of_month)),
        )
        active_officers = base_qs.values("officer").distinct().count()
        return Response(
            {
                "visits_today": stats["visits_today"] or 0,
                "visits_this_month": stats["visits_this_month"] or 0,
                "active_officers": active_officers,
            }
        )
