import logging
from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User

from .models import Route, RouteReport
from .serializers import (
    RouteApproveSerializer,
    RouteCreateSerializer,
    RouteReportCreateUpdateSerializer,
    RouteReportSerializer,
    RouteSerializer,
    RouteUpdateSerializer,
)

logger = logging.getLogger(__name__)


def _routes_queryset(user):
    qs = Route.objects.filter(is_deleted=False).select_related(
        "officer", "officer__department"
    )
    if user.role == User.Role.ADMIN:
        return qs
    if user.role == User.Role.SUPERVISOR:
        if user.department_id:
            return qs.filter(officer__department=user.department)
        return qs.none()
    return qs.filter(officer=user)


class RouteListCreateView(generics.ListCreateAPIView):
    """List routes (optionally filtered by week); create a route (weekly plan day)."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return RouteCreateSerializer
        return RouteSerializer

    def get_queryset(self):
        return _routes_queryset(self.request.user).order_by("-scheduled_date", "-created_at")

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        # Optional: filter by week (e.g. week_start=2025-03-17)
        week_start = request.query_params.get("week_start")
        if week_start:
            try:
                start = datetime.strptime(week_start, "%Y-%m-%d").date()
                # Mon–Sat inclusive (6 working days), aligned with mobile weekly planner.
                end = start + timedelta(days=5)
                queryset = queryset.filter(
                    scheduled_date__gte=start,
                    scheduled_date__lte=end,
                )
            except ValueError:
                pass
        officer_id = request.query_params.get("officer")
        if officer_id and request.user.role in (User.Role.ADMIN, User.Role.SUPERVISOR):
            queryset = queryset.filter(officer_id=officer_id)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = RouteSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = RouteSerializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = RouteCreateSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            logger.warning("POST /api/routes/ validation failed: %s", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        data = serializer.validated_data
        if user.role not in (User.Role.ADMIN, User.Role.SUPERVISOR) and data.get("officer") and data["officer"] != user:
            return Response(
                {"officer": ["You can only create routes for yourself."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        route = serializer.save()
        if user.role in (User.Role.ADMIN, User.Role.SUPERVISOR):
            route.status = Route.Status.ACCEPTED
            route.approved_by = user
            route.rejection_reason = ""
            route.save(update_fields=["status", "approved_by", "rejection_reason", "updated_at"])
        else:
            route.status = Route.Status.PROPOSED
            route.approved_by = None
            route.rejection_reason = ""
            route.save(update_fields=["status", "approved_by", "rejection_reason", "updated_at"])
        route = Route.objects.select_related("officer").get(pk=route.pk)
        out = RouteSerializer(route)
        return Response(out.data, status=status.HTTP_201_CREATED)


class RouteRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or soft-delete a single route."""

    permission_classes = [IsAuthenticated]
    serializer_class = RouteSerializer

    def get_queryset(self):
        return _routes_queryset(self.request.user)

    def get_serializer_class(self):
        if self.request.method in ("PATCH", "PUT"):
            return RouteUpdateSerializer
        return RouteSerializer

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted", "updated_at"])


class RouteApproveView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = RouteApproveSerializer

    def post(self, request, pk):
        user = request.user
        if user.role not in (User.Role.ADMIN, User.Role.SUPERVISOR):
            return Response({"detail": "Only supervisors/admin can approve routes."}, status=status.HTTP_403_FORBIDDEN)

        qs = Route.objects.filter(pk=pk, is_deleted=False).select_related("officer", "officer__department")
        route = qs.first()
        if not route:
            return Response({"detail": "Route not found."}, status=status.HTTP_404_NOT_FOUND)
        if user.role == User.Role.SUPERVISOR:
            if not user.department_id or route.officer.department_id != user.department_id:
                return Response({"detail": "Route is not in your department."}, status=status.HTTP_403_FORBIDDEN)
        if route.status != Route.Status.PROPOSED:
            return Response({"detail": "Only proposed routes can be approved/rejected."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["action"]
        if action == "accept":
            route.status = Route.Status.ACCEPTED
            route.approved_by = user
            route.rejection_reason = ""
        else:
            route.status = Route.Status.REJECTED
            route.approved_by = user
            route.rejection_reason = serializer.validated_data.get("rejection_reason", "").strip()
        route.save(update_fields=["status", "approved_by", "rejection_reason", "updated_at"])
        out = RouteSerializer(route)
        return Response(out.data, status=status.HTTP_200_OK)


class RouteReportDetailView(generics.RetrieveUpdateAPIView):
    """Get or submit/update the report for a route. Create report on first submit if missing."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return RouteReportCreateUpdateSerializer
        return RouteReportSerializer

    def get_object(self):
        from rest_framework.exceptions import NotFound

        route_id = self.kwargs.get("route_id")
        user = self.request.user
        if self.request.method in ("PUT", "PATCH"):
            route = Route.objects.filter(
                pk=route_id,
                is_deleted=False,
                officer=user,
            ).first()
        else:
            route = _routes_queryset(user).filter(pk=route_id).first()
        if not route:
            raise NotFound("Route not found.")
        report, _ = RouteReport.objects.get_or_create(
            route=route,
            defaults={"report_data": {}},
        )
        return report

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = RouteReportCreateUpdateSerializer(
            instance, data=request.data, partial=partial
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(
            submitted_at=timezone.now(),
            submitted_by=request.user,
        )
        out = RouteReportSerializer(instance)
        return Response(out.data)
