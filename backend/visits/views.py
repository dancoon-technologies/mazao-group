from django.conf import settings as django_settings
from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from farmers.models import Farmer, Farm
from .models import Visit
from .serializers import VisitSerializer, VisitCreateSerializer
from .utils import haversine_meters, MAX_VISIT_DISTANCE_METERS


def _validate_photo(file):
    """Validate file type and size. Max 5MB."""
    if not file:
        return None, "Photo is required."
    max_bytes = (getattr(django_settings, "VISIT_PHOTO_MAX_SIZE_MB", 5) * 1024 * 1024)
    if file.size > max_bytes:
        return None, f"Photo must be under {django_settings.VISIT_PHOTO_MAX_SIZE_MB}MB."
    allowed = getattr(django_settings, "VISIT_PHOTO_ALLOWED_EXTENSIONS", ("image/jpeg", "image/png", "image/jpg"))
    if file.content_type not in allowed:
        return None, "Allowed types: JPEG, PNG."
    return None, None


class VisitListCreateView(generics.ListCreateAPIView):
    parser_classes = (MultiPartParser, FormParser)
    list_serializer_class = VisitSerializer
    create_serializer_class = VisitCreateSerializer

    def get_serializer_class(self):
        if self.request.method == "POST":
            return self.create_serializer_class
        return self.list_serializer_class

    def get_queryset(self):
        user = self.request.user
        qs = Visit.objects.select_related("officer", "farmer", "farm")
        if user.role == "admin":
            return qs
        if user.role == "supervisor":
            if getattr(user, "department", None):
                return qs.filter(officer__department=user.department)
            if getattr(user, "region_id_id", None):
                return qs.filter(officer__region_id_id=user.region_id_id)
        return qs.filter(officer=user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        officer_id = request.query_params.get("officer")
        if officer_id:
            queryset = queryset.filter(officer_id=officer_id)
        date_str = request.query_params.get("date")
        if date_str:
            queryset = queryset.filter(created_at__date=date_str)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.list_serializer_class(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.list_serializer_class(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        farmer_id = data["farmer_id"]
        farm_id = data.get("farm_id")
        lat = float(data["latitude"])
        lon = float(data["longitude"])
        photo = request.FILES.get("photo")

        err_msg = _validate_photo(photo)[1]
        if err_msg:
            return Response({"photo": [err_msg]}, status=status.HTTP_400_BAD_REQUEST)

        try:
            farmer = Farmer.objects.prefetch_related("farms").get(pk=farmer_id)
        except Farmer.DoesNotExist:
            return Response({"farmer_id": ["Farmer not found."]}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if user.role != "admin" and farmer.assigned_officer_id != user.pk:
            return Response({"farmer_id": ["You are not assigned to this farmer."]}, status=status.HTTP_403_FORBIDDEN)

        ref_lat, ref_lon = None, None
        farm = None
        if farm_id:
            try:
                farm = Farm.objects.get(pk=farm_id, farmer=farmer)
                ref_lat, ref_lon = float(farm.latitude), float(farm.longitude)
            except Farm.DoesNotExist:
                return Response(
                    {"farm_id": ["Farm not found or does not belong to this farmer."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if ref_lat is None and farmer.farms.exists():
            farms = list(farmer.farms.all())
            min_d = float("inf")
            for f in farms:
                d = haversine_meters(lat, lon, float(f.latitude), float(f.longitude))
                if d < min_d:
                    min_d = d
                    ref_lat, ref_lon = float(f.latitude), float(f.longitude)
                    farm = f
        if ref_lat is None:
            ref_lat, ref_lon = float(farmer.latitude), float(farmer.longitude)

        distance = haversine_meters(lat, lon, ref_lat, ref_lon)
        if distance > MAX_VISIT_DISTANCE_METERS:
            return Response(
                {"detail": "Visit rejected: officer is more than 100m from farmer/farm."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        visit = Visit.objects.create(
            officer=user,
            farmer=farmer,
            farm=farm,
            latitude=lat,
            longitude=lon,
            notes=data.get("notes", ""),
            photo=photo,
            distance_from_farmer=distance,
            verification_status=Visit.VerificationStatus.VERIFIED,
            activity_type=data.get("activity_type", Visit.ActivityType.FARM_TO_FARM_VISITS),
            crop_stage=data.get("crop_stage", ""),
            germination_percent=data.get("germination_percent"),
            survival_rate=data.get("survival_rate", ""),
            pests_diseases=data.get("pests_diseases", ""),
            order_value=data.get("order_value"),
            harvest_kgs=data.get("harvest_kgs"),
            farmers_feedback=data.get("farmers_feedback", ""),
        )
        from django.contrib.auth import get_user_model
        from notifications.services import notify_user
        User = get_user_model()
        if getattr(user, "region_id_id", None):
            supervisors_same_region = User.objects.filter(
                role=User.Role.SUPERVISOR, region_id_id=user.region_id_id
            ).exclude(pk=user.pk)
        else:
            supervisors_same_region = User.objects.none()
        admins = User.objects.filter(role=User.Role.ADMIN)
        for recipient in list(supervisors_same_region) + list(admins):
            notify_user(
                recipient,
                title="New visit recorded",
                message=f"{user.email} recorded a visit to {farmer.name}.",
                channels=["in_app", "email", "sms"],
            )
        out_serializer = VisitSerializer(visit)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)
