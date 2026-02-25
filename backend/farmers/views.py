import logging

from django.db.models import Q
from rest_framework import generics, status
from rest_framework.response import Response

from .models import Farm, Farmer
from .serializers import (
    FarmCreateSerializer,
    FarmerCreateSerializer,
    FarmerSerializer,
    FarmSerializer,
)

logger = logging.getLogger(__name__)


class FarmerListCreateView(generics.ListCreateAPIView):
    """List farmers: all authenticated users see all farmers in the DB. Create: authenticated users."""

    list_serializer_class = FarmerSerializer
    create_serializer_class = FarmerCreateSerializer

    def get_serializer_class(self):
        if self.request.method == "POST":
            return self.create_serializer_class
        return self.list_serializer_class

    def get_queryset(self):
        qs = Farmer.objects.all().select_related("assigned_officer")
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(middle_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(phone__icontains=search)
            )
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(
                "POST /api/farmers/ validation failed user=%s: %s",
                request.user.id,
                serializer.errors,
            )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        farmer = serializer.instance
        logger.info(
            "POST /api/farmers/ created farmer_id=%s by user=%s",
            farmer.id,
            request.user.id,
        )
        out = FarmerSerializer(farmer)
        return Response(out.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        user = self.request.user
        assigned = serializer.validated_data.get("assigned_officer")
        if user.role == "officer" and not assigned:
            farmer = serializer.save(assigned_officer=user)
        else:
            farmer = serializer.save()
        if getattr(farmer, "assigned_officer", None) and farmer.assigned_officer != user:
            from notifications.services import notify_user

            notify_user(
                farmer.assigned_officer,
                title="New farmer assigned to you",
                message=f"A new farmer has been assigned to you: {farmer.name}.",
                channels=["in_app", "email", "sms"],
            )


class FarmListCreateView(generics.ListCreateAPIView):
    """List farms: all authenticated users see all farms (optional ?farmer=uuid). Create: admin or officer assigned to farmer."""

    list_serializer_class = FarmSerializer
    create_serializer_class = FarmCreateSerializer

    def get_serializer_class(self):
        if self.request.method == "POST":
            return self.create_serializer_class
        return self.list_serializer_class

    def get_queryset(self):
        qs = Farm.objects.select_related("farmer", "farmer__assigned_officer").order_by(
            "farmer", "created_at"
        )
        farmer_id = self.request.query_params.get("farmer")
        if farmer_id:
            qs = qs.filter(farmer_id=farmer_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(
                "POST /api/farms/ validation failed user=%s: %s",
                request.user.id,
                serializer.errors,
            )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        farmer_id = serializer.validated_data.pop("farmer_id")
        region_id = serializer.validated_data.pop("region_id")
        county_id = serializer.validated_data.pop("county_id")
        sub_county_id = serializer.validated_data.pop("sub_county_id")
        user = request.user
        try:
            farmer = Farmer.objects.get(pk=farmer_id)
        except Farmer.DoesNotExist:
            logger.warning("POST /api/farms/ farmer_id=%s not found", farmer_id)
            from rest_framework.exceptions import NotFound

            raise NotFound("Farmer not found.")
        if user.role != "admin" and farmer.assigned_officer_id != user.pk:
            logger.warning(
                "POST /api/farms/ forbidden: user=%s not assigned to farmer_id=%s",
                user.id,
                farmer_id,
            )
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You can only add farms for farmers assigned to you.")
        farm = serializer.save(
            farmer=farmer, region_id=region_id, county_id=county_id, sub_county_id=sub_county_id
        )
        logger.info(
            "POST /api/farms/ created farm_id=%s farmer_id=%s by user=%s",
            farm.id,
            farmer_id,
            user.id,
        )
        out = FarmSerializer(farm)
        return Response(out.data, status=status.HTTP_201_CREATED)
