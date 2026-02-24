from rest_framework import generics, status
from rest_framework.response import Response

from .models import Farm, Farmer
from .serializers import (
    FarmCreateSerializer,
    FarmerCreateSerializer,
    FarmerSerializer,
    FarmSerializer,
)


class FarmerListCreateView(generics.ListCreateAPIView):
    """List farmers. Admin: all. Officer: only assigned. Create: authenticated users."""

    list_serializer_class = FarmerSerializer
    create_serializer_class = FarmerCreateSerializer

    def get_serializer_class(self):
        if self.request.method == "POST":
            return self.create_serializer_class
        return self.list_serializer_class

    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return Farmer.objects.all().select_related("assigned_officer")
        if user.role == "supervisor":
            if getattr(user, "department", None):
                return Farmer.objects.filter(
                    assigned_officer__department=user.department
                ).select_related("assigned_officer")
            if getattr(user, "region_id_id", None):
                return Farmer.objects.filter(
                    assigned_officer__region_id_id=user.region_id_id
                ).select_related("assigned_officer")
        return Farmer.objects.filter(assigned_officer=user).select_related("assigned_officer")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        out = FarmerSerializer(serializer.instance)
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
    """List farms (optional ?farmer=uuid). Create: admin or officer assigned to farmer."""

    list_serializer_class = FarmSerializer
    create_serializer_class = FarmCreateSerializer

    def get_serializer_class(self):
        if self.request.method == "POST":
            return self.create_serializer_class
        return self.list_serializer_class

    def get_queryset(self):
        user = self.request.user
        qs = Farm.objects.select_related("farmer", "farmer__assigned_officer").order_by(
            "farmer", "created_at"
        )
        farmer_id = self.request.query_params.get("farmer")
        if farmer_id:
            qs = qs.filter(farmer_id=farmer_id)
        if user.role == "admin":
            return qs
        if user.role == "supervisor":
            if getattr(user, "department", None):
                return qs.filter(farmer__assigned_officer__department=user.department)
            if getattr(user, "region_id_id", None):
                return qs.filter(farmer__assigned_officer__region_id_id=user.region_id_id)
        return qs.filter(farmer__assigned_officer=user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        farmer_id = serializer.validated_data.pop("farmer_id")
        region_id = serializer.validated_data.pop("region_id")
        county_id = serializer.validated_data.pop("county_id")
        sub_county_id = serializer.validated_data.pop("sub_county_id")
        user = request.user
        try:
            farmer = Farmer.objects.get(pk=farmer_id)
        except Farmer.DoesNotExist as e:
            from rest_framework.exceptions import NotFound

            raise NotFound("Farmer not found.") from e
        if user.role != "admin" and farmer.assigned_officer_id != user.pk:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You can only add farms for farmers assigned to you.")
        farm = serializer.save(
            farmer=farmer, region_id=region_id, county_id=county_id, sub_county_id=sub_county_id
        )
        out = FarmSerializer(farm)
        return Response(out.data, status=status.HTTP_201_CREATED)
