from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Visit


class DashboardStatsView(APIView):
    """GET /api/dashboard/stats/ — visits_today, visits_this_month, active_officers. Admin & Supervisor only."""

    def get(self, request):
        if request.user.role not in ("admin", "supervisor"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Dashboard is for admin and supervisor only.")
        today = timezone.now().date()
        start_of_month = today.replace(day=1)
        visits_today = Visit.objects.filter(created_at__date=today).count()
        visits_this_month = Visit.objects.filter(created_at__date__gte=start_of_month).count()
        # Active officers: distinct officers who have at least one visit (e.g. in last 30 days or all time)
        from django.db.models import Count
        active_officers = (
            Visit.objects.values("officer")
            .annotate(c=Count("id"))
            .count()
        )
        return Response({
            "visits_today": visits_today,
            "visits_this_month": visits_this_month,
            "active_officers": active_officers,
        })
