import logging
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Schedule
from .serializers import ScheduleCreateSerializer, ScheduleSerializer, ScheduleUpdateSerializer

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
            "created_by", "officer", "officer__department", "farmer", "farm", "approved_by"
        ).order_by("-scheduled_date", "-created_at")
        if user.role == "admin":
            return qs
        if user.role == "supervisor":
            # Supervisors see only schedules for officers in their department.
            if user.department_id:
                return qs.filter(officer__department=user.department)
            return qs.none()
        return qs.filter(officer=user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        if request.user.role == "admin":
            department_slug = request.query_params.get("department")
            if department_slug:
                queryset = queryset.filter(officer__department__slug=department_slug)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.list_serializer_class(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.list_serializer_class(queryset, many=True)
        return Response(serializer.data)

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
                farm=data.get("farm"),
                scheduled_date=data["scheduled_date"],
                notes=data.get("notes", ""),
                status=Schedule.Status.ACCEPTED,
                approved_by=user,
            )
            schedule = Schedule.objects.select_related("officer", "farmer", "farm", "created_by", "approved_by").get(pk=schedule.pk)
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
                farm=data.get("farm"),
                scheduled_date=data["scheduled_date"],
                notes=data.get("notes", ""),
                status=Schedule.Status.PROPOSED,
            )
            schedule = Schedule.objects.select_related("officer", "farmer", "farm", "created_by").get(pk=schedule.pk)
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
            schedule = Schedule.objects.select_related("officer", "officer__department", "farmer", "farm").get(pk=pk)
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
            if not user.department_id or schedule.officer.department_id != user.department_id:
                return Response(
                    {"detail": "Schedule is not in your department."},
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


def _schedule_editable_by_date(scheduled_date):
    """Proposed schedule is editable only if scheduled date is more than one day from today."""
    today = timezone.now().date()
    return scheduled_date >= today + timedelta(days=2)


class ScheduleUpdateView(generics.UpdateAPIView):
    """PATCH schedule: supervisors and officers may request change of proposed schedule if not within one day of date."""

    permission_classes = [IsAuthenticated]
    serializer_class = ScheduleUpdateSerializer
    http_method_names = ["patch", "options", "head"]

    def get_queryset(self):
        user = self.request.user
        qs = Schedule.objects.select_related(
            "created_by", "officer", "officer__department", "farmer", "farm", "approved_by"
        )
        if user.role == "admin":
            return qs
        if user.role == "supervisor":
            if user.department_id:
                return qs.filter(officer__department=user.department)
            return qs.none()
        if user.role == "officer":
            return qs.filter(officer=user)
        return qs.none()

    def check_can_edit(self, schedule, user):
        if user.role not in ("supervisor", "officer"):
            return False, "Only supervisors and field extension officers can request schedule changes."
        if schedule.status != Schedule.Status.PROPOSED:
            return False, "Only proposed schedules can be edited."
        if not _schedule_editable_by_date(schedule.scheduled_date):
            return False, "Schedule cannot be edited when it is within one day of the proposed date."
        if user.role == "officer" and schedule.officer_id != user.id:
            return False, "You can only edit your own proposed schedules."
        if user.role == "supervisor" and user.department_id and schedule.officer.department_id != user.department_id:
            return False, "Schedule is not in your department."
        return True, None

    def patch(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        can_edit, err_msg = self.check_can_edit(instance, user)
        if not can_edit:
            # 403: role, ownership, department; 400: not proposed, date too close
            is_forbidden = err_msg in (
                "Only supervisors and field extension officers can request schedule changes.",
                "You can only edit your own proposed schedules.",
                "Schedule is not in your department.",
            )
            return Response(
                {"detail": err_msg},
                status=status.HTTP_403_FORBIDDEN if is_forbidden else status.HTTP_400_BAD_REQUEST,
            )
        # If new scheduled_date is provided, it must also be at least 2 days from today
        new_date = request.data.get("scheduled_date")
        if new_date:
            try:
                from datetime import datetime
                if isinstance(new_date, str):
                    parsed = datetime.strptime(new_date[:10], "%Y-%m-%d").date()
                else:
                    parsed = new_date
                if not _schedule_editable_by_date(parsed):
                    return Response(
                        {"scheduled_date": ["New date must be at least two days from today."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except (ValueError, TypeError):
                pass  # Let serializer validate format
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        # Officer cannot change the assigned officer
        if user.role == "officer" and "officer" in data:
            data = {k: v for k, v in data.items() if k != "officer"}
        if user.role == "supervisor" and "officer" in data:
            new_officer = data.get("officer")
            if new_officer and getattr(user, "department", None) and new_officer.department != user.department:
                return Response(
                    {"officer": ["You can only assign officers in your department."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        for attr, value in data.items():
            setattr(instance, attr, value)
        instance.save(update_fields=[f for f in data.keys() if hasattr(instance, f)])
        instance.refresh_from_db()
        instance = Schedule.objects.select_related("officer", "farmer", "farm", "created_by", "approved_by").get(pk=instance.pk)
        logger.info(
            "PATCH /api/schedules/%s by user=%s",
            instance.id,
            user.id,
        )
        return Response(ScheduleSerializer(instance).data)
