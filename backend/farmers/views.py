import logging

from django.db.models import Q
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.exceptions import NotFound

from .geo_validation import (
    validate_device_in_admin_area,
    validate_device_near_farm,
)
from .models import Farm, Farmer
from .serializers import (
    FarmCreateSerializer,
    FarmerCreateSerializer,
    FarmerSerializer,
    FarmSerializer,
)

logger = logging.getLogger(__name__)


class FarmerListCreateView(generics.ListCreateAPIView):
    """List farmers: all authenticated users see all farmers. Create: authenticated users."""

    list_serializer_class = FarmerSerializer
    create_serializer_class = FarmerCreateSerializer

    def get_serializer_class(self):
        if self.request.method == "POST":
            return self.create_serializer_class
        return self.list_serializer_class

    def get_queryset(self):
        qs = Farmer.objects.all()
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(middle_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(phone__icontains=search)
            )
        is_stockist = self.request.query_params.get("is_stockist")
        if is_stockist is not None:
            if is_stockist.lower() in ("true", "1", "yes"):
                qs = qs.filter(is_stockist=True)
            elif is_stockist.lower() in ("false", "0", "no"):
                qs = qs.filter(is_stockist=False)
        is_sacco = self.request.query_params.get("is_sacco")
        if is_sacco is not None:
            if is_sacco.lower() in ("true", "1", "yes"):
                qs = qs.filter(is_sacco=True)
            elif is_sacco.lower() in ("false", "0", "no"):
                qs = qs.filter(is_sacco=False)
        is_group = self.request.query_params.get("is_group")
        if is_group is not None:
            if is_group.lower() in ("true", "1", "yes"):
                qs = qs.filter(is_group=True)
            elif is_group.lower() in ("false", "0", "no"):
                qs = qs.filter(is_group=False)
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
        serializer.save()


class FarmerRetrieveView(generics.RetrieveAPIView):
    """Retrieve a single farmer by id. Same visibility as list (all authenticated users)."""

    serializer_class = FarmerSerializer
    queryset = Farmer.objects.all().order_by()

    def get_object(self):
        try:
            return self.get_queryset().get(pk=self.kwargs["pk"])
        except Farmer.DoesNotExist:
            raise NotFound("Farmer not found.")


class FarmListCreateView(generics.ListCreateAPIView):
    """List farms: all authenticated users (admin, supervisor, officers) see all farms (optional ?farmer=uuid). Create: admin or officer (with GPS validation for officers)."""

    list_serializer_class = FarmSerializer
    create_serializer_class = FarmCreateSerializer

    def get_serializer_class(self):
        if self.request.method == "POST":
            return self.create_serializer_class
        return self.list_serializer_class

    def get_queryset(self):
        qs = Farm.objects.select_related(
            "farmer",
            "region_id",
            "county_id",
            "sub_county_id",
        ).order_by("farmer", "created_at")
        farmer_id = self.request.query_params.get("farmer")
        if farmer_id:
            qs = qs.filter(farmer_id=farmer_id)
        is_outlet = self.request.query_params.get("is_outlet")
        if is_outlet is not None:
            if is_outlet.lower() in ("true", "1", "yes"):
                qs = qs.filter(is_outlet=True)
            elif is_outlet.lower() in ("false", "0", "no"):
                qs = qs.filter(is_outlet=False)
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
        device_lat = serializer.validated_data.pop("device_latitude", None)
        device_lon = serializer.validated_data.pop("device_longitude", None)
        user = request.user
        try:
            farmer = Farmer.objects.get(pk=farmer_id)
        except Farmer.DoesNotExist:
            logger.warning("POST /api/farms/ farmer_id=%s not found", farmer_id)
            from rest_framework.exceptions import NotFound

            raise NotFound("Farmer not found.")
        # Extension officers must be at the farm location (GPS validation)
        if user.role == "officer":
            if device_lat is None or device_lon is None:
                return Response(
                    {"detail": "Device location is required. Enable location and try again."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            farm_lat = float(serializer.validated_data["latitude"])
            farm_lon = float(serializer.validated_data["longitude"])
            ok, err = validate_device_near_farm(device_lat, device_lon, farm_lat, farm_lon)
            if not ok:
                return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
            ok, err = validate_device_in_admin_area(
                device_lat, device_lon, region_id.name, county_id.name
            )
            if not ok:
                return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)

        farm = serializer.save(
            farmer=farmer, region_id=region_id, county_id=county_id, sub_county_id=sub_county_id
        )
        logger.info(
            "POST /api/farms/ created farm_id=%s farmer_id=%s by user=%s",
            farm.id,
            farmer_id,
            user.id,
        )
        farm = Farm.objects.select_related(
            "farmer", "region_id", "county_id", "sub_county_id"
        ).get(pk=farm.pk)
        out = FarmSerializer(farm)
        return Response(out.data, status=status.HTTP_201_CREATED)


class FarmRetrieveView(generics.RetrieveAPIView):
    """Retrieve a single farm by id. Same visibility as list (all authenticated users)."""

    serializer_class = FarmSerializer
    queryset = Farm.objects.select_related(
        "farmer",
        "region_id",
        "county_id",
        "sub_county_id",
    ).order_by()

    def get_object(self):
        try:
            return self.get_queryset().get(pk=self.kwargs["pk"])
        except Farm.DoesNotExist:
            raise NotFound("Farm not found.")
