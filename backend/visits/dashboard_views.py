import logging
from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Department
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
    """GET /api/dashboard/stats/ — visits, officers, verification, (admin: farmers/farms). Admin & Supervisor only."""

    def get(self, request):
        base_qs = _get_base_queryset(request)
        user = request.user
        today = timezone.now().date()
        start_of_month = today.replace(day=1)
        stats = base_qs.aggregate(
            visits_today=Count("id", filter=Q(created_at__date=today)),
            visits_this_month=Count("id", filter=Q(created_at__date__gte=start_of_month)),
            visits_verified=Count("id", filter=Q(verification_status=Visit.VerificationStatus.VERIFIED)),
            visits_rejected=Count("id", filter=Q(verification_status=Visit.VerificationStatus.REJECTED)),
        )
        active_officers = base_qs.values("officer").distinct().count()
        total_visits = (stats["visits_verified"] or 0) + (stats["visits_rejected"] or 0)
        verification_rate = (
            round(100 * (stats["visits_verified"] or 0) / total_visits, 1) if total_visits else None
        )
        payload = {
            "visits_today": stats["visits_today"] or 0,
            "visits_this_month": stats["visits_this_month"] or 0,
            "active_officers": active_officers,
            "visits_verified": stats["visits_verified"] or 0,
            "visits_rejected": stats["visits_rejected"] or 0,
            "verification_rate_pct": verification_rate,
        }
        if user.role == "admin":
            from farmers.models import Farm, Farmer
            payload["total_farmers"] = Farmer.objects.count()
            payload["total_farms"] = Farm.objects.count()
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


class DashboardStatsByDepartmentView(APIView):
    """GET /api/dashboard/stats-by-department/ — visits_today, visits_this_month, active_officers per department. Admin sees all; supervisor sees own department only."""

    def get(self, request):
        base_qs = _get_base_queryset(request)
        user = request.user
        if user.role == "supervisor" and user.department_id:
            departments = [user.department]
        else:
            departments = list(Department.objects.all().order_by("name"))
        result = []
        today = timezone.now().date()
        start_of_month = today.replace(day=1)
        for dept in departments:
            dept_qs = base_qs.filter(officer__department=dept)
            stats = dept_qs.aggregate(
                visits_today=Count("id", filter=Q(created_at__date=today)),
                visits_this_month=Count("id", filter=Q(created_at__date__gte=start_of_month)),
            )
            active = dept_qs.values("officer").distinct().count()
            result.append({
                "department_slug": dept.slug,
                "department_name": dept.name,
                "visits_today": stats["visits_today"] or 0,
                "visits_this_month": stats["visits_this_month"] or 0,
                "active_officers": active,
            })
        logger.info("GET /api/dashboard/stats-by-department/ user=%s departments=%s", user.id, len(result))
        return Response(result)


class DashboardVisitsByActivityView(APIView):
    """GET /api/dashboard/visits-by-activity/ — count of visits per activity_type. Admin & Supervisor only."""

    def get(self, request):
        base_qs = _get_base_queryset(request)
        qs = (
            base_qs.values("activity_type")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        result = [{"activity_type": item["activity_type"] or "unknown", "count": item["count"]} for item in qs]
        logger.info("GET /api/dashboard/visits-by-activity/ user=%s activities=%s", request.user.id, len(result))
        return Response(result)


class DashboardTopOfficersView(APIView):
    """GET /api/dashboard/top-officers/?limit=10 — officers ranked by visits this month. Admin & Supervisor only."""

    def get(self, request):
        base_qs = _get_base_queryset(request)
        try:
            limit = min(20, max(5, int(request.GET.get("limit", 10))))
        except ValueError:
            limit = 10
        today = timezone.now().date()
        start_of_month = today.replace(day=1)
        qs = (
            base_qs.filter(created_at__date__gte=start_of_month)
            .values("officer")
            .annotate(visits_count=Count("id"))
            .order_by("-visits_count")[:limit]
        )
        from accounts.models import User
        officer_ids = [item["officer"] for item in qs]
        officers = {u.id: u for u in User.objects.filter(id__in=officer_ids)}
        result = []
        for item in qs:
            u = officers.get(item["officer"])
            name = (u.display_name or u.email) if u else "—"
            result.append({
                "officer_id": str(item["officer"]),
                "officer_email": u.email if u else "",
                "display_name": name,
                "visits_count": item["visits_count"],
            })
        logger.info("GET /api/dashboard/top-officers/ user=%s limit=%s count=%s", request.user.id, limit, len(result))
        return Response(result)


class DashboardSchedulesSummaryView(APIView):
    """GET /api/dashboard/schedules-summary/ — proposed/accepted this month, scheduled today. Admin & Supervisor only."""

    def get(self, request):
        from schedules.models import Schedule

        base_visit_qs = _get_base_queryset(request)
        user = request.user
        today = timezone.now().date()
        schedule_qs = Schedule.objects.filter(
            scheduled_date__month=today.month,
            scheduled_date__year=today.year,
        )
        if user.role == "supervisor" and user.department_id:
            schedule_qs = schedule_qs.filter(officer__department=user.department)
        proposed = schedule_qs.filter(status=Schedule.Status.PROPOSED).count()
        accepted = schedule_qs.filter(status=Schedule.Status.ACCEPTED).count()
        today_qs = Schedule.objects.filter(scheduled_date=today, status=Schedule.Status.ACCEPTED)
        if user.role == "supervisor" and user.department_id:
            today_qs = today_qs.filter(officer__department=user.department)
        scheduled_today = today_qs.count()
        recorded_today = base_visit_qs.filter(created_at__date=today).count()
        payload = {
            "schedules_proposed_this_month": proposed,
            "schedules_accepted_this_month": accepted,
            "schedules_scheduled_today": scheduled_today,
            "visits_recorded_today": recorded_today,
        }
        logger.info("GET /api/dashboard/schedules-summary/ user=%s %s", user.id, payload)
        return Response(payload)
