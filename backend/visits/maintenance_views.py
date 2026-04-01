from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import MaintenanceIncident, MaintenanceIncidentPhoto
from .serializers import (
    MaintenanceIncidentCreateSerializer,
    MaintenanceIncidentSerializer,
    MaintenanceIncidentUpdateSerializer,
)


class MaintenanceIncidentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return MaintenanceIncidentCreateSerializer
        return MaintenanceIncidentSerializer

    def get_queryset(self):
        user = self.request.user
        qs = MaintenanceIncident.objects.select_related("officer", "supervisor")
        if user.role == "admin":
            return qs
        if user.role == "supervisor":
            if user.department_id:
                return qs.filter(officer__department_id=user.department_id)
            return qs.none()
        return qs.filter(officer=user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        status_param = request.query_params.get("status")
        officer_param = request.query_params.get("officer")
        if status_param:
            queryset = queryset.filter(status=status_param)
        if officer_param:
            queryset = queryset.filter(officer_id=officer_param)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = MaintenanceIncidentSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = MaintenanceIncidentSerializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        if request.user.role != "officer":
            return Response({"detail": "Only officers can report maintenance incidents."}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        photos = serializer.validated_data.pop("photo", [])
        obj = serializer.save(officer=request.user, status=MaintenanceIncident.Status.REPORTED)
        for idx, img in enumerate(photos):
            MaintenanceIncidentPhoto.objects.create(incident=obj, image=img, order=idx)
        out = MaintenanceIncidentSerializer(obj)
        return Response(out.data, status=status.HTTP_201_CREATED)


class MaintenanceIncidentUpdateView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MaintenanceIncidentUpdateSerializer
    queryset = MaintenanceIncident.objects.select_related("officer", "supervisor")

    def update(self, request, *args, **kwargs):
        user = request.user
        if user.role not in ("admin", "supervisor"):
            return Response({"detail": "Only supervisors and admins can update incidents."}, status=status.HTTP_403_FORBIDDEN)
        incident = self.get_object()
        if user.role == "supervisor":
            if not user.department_id or incident.officer.department_id != user.department_id:
                return Response({"detail": "Incident is not in your department."}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(incident, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        status_value = serializer.validated_data.get("status")
        note = serializer.validated_data.get("supervisor_notes")
        if note is not None:
            incident.supervisor_notes = note
        incident.supervisor = user
        now = timezone.now()
        if status_value:
            incident.status = status_value
            if status_value == MaintenanceIncident.Status.VERIFIED_BREAKDOWN:
                incident.breakdown_verified_at = now
                incident.breakdown_verified_latitude = serializer.validated_data.get("breakdown_verified_latitude")
                incident.breakdown_verified_longitude = serializer.validated_data.get("breakdown_verified_longitude")
            elif status_value == MaintenanceIncident.Status.AT_GARAGE:
                incident.garage_recorded_at = now
                incident.garage_latitude = serializer.validated_data.get("garage_latitude")
                incident.garage_longitude = serializer.validated_data.get("garage_longitude")
            elif status_value == MaintenanceIncident.Status.RELEASED:
                incident.released_at = now
            elif status_value == MaintenanceIncident.Status.REJECTED:
                incident.rejected_at = now
        incident.save()
        out = MaintenanceIncidentSerializer(incident)
        return Response(out.data)
