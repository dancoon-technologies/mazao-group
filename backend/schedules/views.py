import logging

from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Schedule
from .serializers import ScheduleCreateSerializer, ScheduleSerializer

logger = logging.getLogger(__name__)


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
            "created_by", "officer", "farmer", "approved_by"
        ).order_by("-scheduled_date", "-created_at")
        if user.role == "admin":
            return qs
        if user.role == "supervisor":
            if getattr(user, "department", None):
                return qs.filter(officer__department=user.department)
            if getattr(user, "region_id_id", None):
                return qs.filter(Q(created_by=user) | Q(officer__region_id_id=user.region_id_id))
        return qs.filter(officer=user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.warning("POST /api/schedules/ validation failed: %s", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        user = request.user

        if user.role in ("admin", "supervisor"):
            officer = data.get("officer")
            if not officer:
                return Response(
                    {"officer": ["Required when creating schedule as admin/supervisor."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if user.role == "supervisor":
                if getattr(user, "department", None):
                    if officer.department != user.department:
                        return Response(
                            {"officer": ["You can only schedule officers in your department."]},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                elif not user.same_region_as(officer):
                    return Response(
                        {"officer": ["You can only schedule officers in your region."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            schedule = Schedule.objects.create(
                created_by=user,
                officer=officer,
                farmer=data.get("farmer"),
                scheduled_date=data["scheduled_date"],
                notes=data.get("notes", ""),
                status=Schedule.Status.ACCEPTED,
                approved_by=user,
            )
            from django.utils.formats import date_format

            from notifications.services import notify_user

            farmer_name = schedule.farmer.name if schedule.farmer else "No specific farmer"
            date_str = date_format(schedule.scheduled_date, use_l10n=True)
            notify_user(
                officer,
                title="New visit scheduled",
                message=f"You have a visit scheduled on {date_str}. Farmer: {farmer_name}. Notes: {schedule.notes or 'None'}",
                channels=["in_app", "email", "sms"],
            )
        else:
            officer = data.get("officer")
            if officer and officer != user:
                return Response(
                    {"officer": ["You can only propose schedules for yourself."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            schedule = Schedule.objects.create(
                created_by=user,
                officer=user,
                farmer=data.get("farmer"),
                scheduled_date=data["scheduled_date"],
                notes=data.get("notes", ""),
                status=Schedule.Status.PROPOSED,
            )
            from django.contrib.auth import get_user_model
            from django.utils.formats import date_format

            from notifications.services import notify_user

            User = get_user_model()
            if getattr(user, "region_id_id", None):
                supervisors_same_region = User.objects.filter(
                    role=User.Role.SUPERVISOR, region_id_id=user.region_id_id
                ).exclude(pk=user.pk)
            else:
                supervisors_same_region = User.objects.none()
            admins = User.objects.filter(role=User.Role.ADMIN)
            farmer_name = schedule.farmer.name if schedule.farmer else "No specific farmer"
            date_str = date_format(schedule.scheduled_date, use_l10n=True)
            message = f"{user.email} proposed a visit on {date_str}. Farmer: {farmer_name}. Please approve or reject."
            for recipient in list(supervisors_same_region) + list(admins):
                notify_user(
                    recipient,
                    title="Schedule proposal for approval",
                    message=message,
                    channels=["in_app", "email", "sms"],
                )
        logger.info(
            "POST /api/schedules/ created schedule_id=%s officer_id=%s farmer_id=%s by user=%s",
            schedule.id,
            schedule.officer_id,
            schedule.farmer_id,
            user.id,
        )
        out = ScheduleSerializer(schedule)
        return Response(out.data, status=status.HTTP_201_CREATED)


class ScheduleApproveView(generics.GenericAPIView):
    """POST with {"action": "accept" | "reject"}. Supervisor or admin only."""

    permission_classes = [IsAuthenticated]
    queryset = Schedule.objects.all()

    def post(self, request, pk):
        try:
            schedule = Schedule.objects.select_related("officer", "farmer").get(pk=pk)
        except Schedule.DoesNotExist:
            logger.warning("POST /api/schedules/%s/approve schedule not found", pk)
            return Response(
                {"detail": "Schedule not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        user = request.user
        if user.role not in ("admin", "supervisor"):
            logger.warning("POST /api/schedules/%s/approve forbidden user=%s role=%s", pk, user.id, user.role)
            return Response(
                {"detail": "Only supervisors and admins can approve or reject schedules."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if user.role == "supervisor":
            if getattr(user, "department", None):
                if schedule.officer.department != user.department:
                    return Response(
                        {"detail": "Schedule is not in your department."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            elif not user.same_region_as(schedule.officer):
                return Response(
                    {"detail": "Schedule is not in your region."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        if schedule.status != Schedule.Status.PROPOSED:
            logger.warning("POST /api/schedules/%s/approve already status=%s", pk, schedule.status)
            return Response(
                {"detail": f"Schedule is already {schedule.get_status_display()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        action = (request.data.get("action") or "").strip().lower()
        if action == "accept":
            schedule.status = Schedule.Status.ACCEPTED
            schedule.approved_by = user
            schedule.save(update_fields=["status", "approved_by"])
            logger.info("POST /api/schedules/%s/approve accepted by user=%s", pk, user.id)
            from django.utils.formats import date_format

            from notifications.services import notify_user

            farmer_name = schedule.farmer.name if schedule.farmer else "No specific farmer"
            date_str = date_format(schedule.scheduled_date, use_l10n=True)
            notify_user(
                schedule.officer,
                title="Schedule accepted",
                message=f"Your visit scheduled on {date_str} (Farmer: {farmer_name}) has been accepted.",
                channels=["in_app", "email", "sms"],
            )
            return Response(ScheduleSerializer(schedule).data)
        if action == "reject":
            schedule.status = Schedule.Status.REJECTED
            schedule.approved_by = user
            schedule.save(update_fields=["status", "approved_by"])
            logger.info("POST /api/schedules/%s/approve rejected by user=%s", pk, user.id)
            from django.utils.formats import date_format

            from notifications.services import notify_user

            date_str = date_format(schedule.scheduled_date, use_l10n=True)
            notify_user(
                schedule.officer,
                title="Schedule rejected",
                message=f"Your visit scheduled on {date_str} has been rejected.",
                channels=["in_app", "email", "sms"],
            )
            return Response(ScheduleSerializer(schedule).data)
        logger.warning("POST /api/schedules/%s/approve invalid action=%s", pk, request.data.get("action"))
        return Response(
            {"action": ["Must be 'accept' or 'reject'."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
