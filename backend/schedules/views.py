from django.db.models import Q
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Schedule
from .serializers import ScheduleSerializer, ScheduleCreateSerializer


class ScheduleListCreateView(generics.ListCreateAPIView):
    list_serializer_class = ScheduleSerializer
    create_serializer_class = ScheduleCreateSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return self.create_serializer_class
        return self.list_serializer_class

    def get_queryset(self):
        user = self.request.user
        qs = Schedule.objects.select_related(
            "created_by", "officer", "farmer"
        ).order_by("-scheduled_date", "-created_at")
        if user.role == "admin":
            return qs
        if user.role == "supervisor":
            return qs.filter(
                Q(created_by=user) | Q(officer__region=user.region)
            )
        return qs.filter(officer=user)

    def create(self, request, *args, **kwargs):
        if request.user.role not in ("admin", "supervisor"):
            return Response(
                {"detail": "Only supervisors and admins can create schedules."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        officer = data["officer"]
        if request.user.role == "supervisor" and officer.region != request.user.region:
            return Response(
                {"officer": ["You can only schedule officers in your region."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        schedule = Schedule.objects.create(
            created_by=request.user,
            officer=officer,
            farmer=data.get("farmer"),
            scheduled_date=data["scheduled_date"],
            notes=data.get("notes", ""),
        )
        from notifications.services import notify_user
        from django.utils.formats import date_format
        farmer_name = schedule.farmer.name if schedule.farmer else "No specific farmer"
        date_str = date_format(schedule.scheduled_date, use_l10n=True)
        notify_user(
            officer,
            title="New visit scheduled",
            message=f"You have a visit scheduled on {date_str}. Farmer: {farmer_name}. Notes: {schedule.notes or 'None'}",
            channels=["in_app", "email", "sms"],
        )
        out = ScheduleSerializer(schedule)
        return Response(out.data, status=status.HTTP_201_CREATED)
