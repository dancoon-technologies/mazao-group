import json

from rest_framework import serializers

from accounts.models import Department
from .models import Product, Visit, VisitProduct
from .models import MaintenanceIncident, MaintenanceIncidentPhoto


class ProductLinesField(serializers.Field):
    """Accept product_lines as list or JSON string (e.g. from multipart form)."""

    def to_internal_value(self, data):
        if data is None:
            return []
        if isinstance(data, list):
            return data
        if isinstance(data, str) and data.strip():
            try:
                return json.loads(data)
            except json.JSONDecodeError:
                return []
        return []


class VisitSerializer(serializers.ModelSerializer):
    officer = serializers.UUIDField(source="officer_id", read_only=True)
    farmer = serializers.UUIDField(source="farmer_id", read_only=True)
    farm = serializers.UUIDField(source="farm_id", read_only=True, allow_null=True)
    schedule = serializers.UUIDField(source="schedule_id", read_only=True, allow_null=True)
    route = serializers.UUIDField(source="route_id", read_only=True, allow_null=True)
    route_display = serializers.SerializerMethodField()
    officer_email = serializers.SerializerMethodField()
    officer_display_name = serializers.SerializerMethodField()
    farmer_display_name = serializers.SerializerMethodField()
    farm_display_name = serializers.SerializerMethodField()
    schedule_display = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    product_lines = serializers.SerializerMethodField()
    partner_is_stockist = serializers.SerializerMethodField()

    class Meta:
        model = Visit
        fields = (
            "id",
            "officer",
            "officer_email",
            "officer_display_name",
            "farmer",
            "farmer_display_name",
            "partner_is_stockist",
            "farm",
            "farm_display_name",
            "schedule",
            "schedule_display",
            "route",
            "route_display",
            "latitude",
            "longitude",
            "photo",
            "photos",
            "photo_taken_at",
            "photo_device_info",
            "photo_place_name",
            "notes",
            "distance_from_farmer",
            "verification_status",
            "activity_type",
            "activity_types",
            "crop_stage",
            "germination_percent",
            "survival_rate",
            "pests_diseases",
            "order_value",
            "harvest_kgs",
            "farmers_feedback",
            "number_of_stockists_visited",
            "merchandising",
            "counter_training",
            "product_lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "officer",
            "farmer",
            "distance_from_farmer",
            "verification_status",
            "created_at",
        )

    def get_officer_email(self, obj):
        return obj.officer.email if obj.officer_id else ""

    def get_officer_display_name(self, obj):
        return obj.officer.display_name if obj.officer_id and obj.officer else ""

    def get_farmer_display_name(self, obj):
        return obj.farmer.name if obj.farmer_id else ""

    def get_partner_is_stockist(self, obj):
        return getattr(obj.farmer, "is_stockist", False) if obj.farmer_id else None

    def get_farm_display_name(self, obj):
        if obj.farm_id and obj.farm:
            return str(obj.farm)
        return None

    def get_schedule_display(self, obj):
        if obj.schedule_id and obj.schedule:
            return f"{obj.schedule.scheduled_date} — {obj.schedule.farmer.name if obj.schedule.farmer_id else 'N/A'}"
        return None

    def get_route_display(self, obj):
        if obj.route_id and getattr(obj, "route", None):
            return f"{obj.route.scheduled_date} — {obj.route.name or 'Route'}"
        return None

    def get_photos(self, obj):
        """List of photo URLs: primary first, then extra VisitPhotos in order."""
        request = self.context.get("request")
        urls = []
        if obj.photo:
            url = obj.photo.url
            if request:
                url = request.build_absolute_uri(url)
            urls.append(url)
        for vp in (obj.photos.all() if hasattr(obj, "photos") else []):
            if vp.image:
                url = vp.image.url
                if request:
                    url = request.build_absolute_uri(url)
                urls.append(url)
        return urls

    def get_product_lines(self, obj):
        """Sales per product for this visit."""
        lines = getattr(obj, "product_lines_prefetched", None)
        if lines is None and hasattr(obj, "product_lines"):
            lines = obj.product_lines.select_related("product").all()
        if not lines:
            return []
        return [
            {
                "product_id": str(vp.product_id),
                "product_name": vp.product.name,
                "product_code": vp.product.code or "",
                "product_unit": vp.product.unit or "",
                "quantity_sold": str(vp.quantity_sold),
            }
            for vp in lines
        ]


class VisitCreateSerializer(serializers.ModelSerializer):
    farmer_id = serializers.UUIDField(write_only=True)
    farm_id = serializers.UUIDField(write_only=True, required=True, allow_null=False)
    # Optional: visits can be recorded either from an accepted schedule or from a route stop.
    schedule_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    route_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    photo_taken_at = serializers.DateTimeField(required=False, allow_null=True)
    photo_device_info = serializers.CharField(required=False, allow_blank=True, default="", max_length=120)
    photo_place_name = serializers.CharField(required=False, allow_blank=True, default="", max_length=120)
    activity_types = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        allow_empty=True,
        help_text="List of activity type slugs. If provided, activity_type is the first.",
    )
    product_lines = ProductLinesField(
        required=False,
        help_text="List of {product_id, quantity_sold} for sales during visit (list or JSON string).",
    )

    class Meta:
        model = Visit
        extra_kwargs = {
            "notes": {"max_length": 2000},
            "farmers_feedback": {"max_length": 2000},
        }
        fields = (
            "farmer_id",
            "farm_id",
            "schedule_id",
            "route_id",
            "latitude",
            "longitude",
            "notes",
            "photo",
            "photo_taken_at",
            "photo_device_info",
            "photo_place_name",
            "activity_type",
            "activity_types",
            "crop_stage",
            "germination_percent",
            "survival_rate",
            "pests_diseases",
            "order_value",
            "harvest_kgs",
            "farmers_feedback",
            "number_of_stockists_visited",
            "merchandising",
            "counter_training",
            "product_lines",
        )


class ProductSerializer(serializers.ModelSerializer):
    department_slug = serializers.CharField(source="department.slug", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = Product
        fields = ("id", "name", "code", "unit", "department", "department_slug", "department_name")
        read_only_fields = ("id",)


class ProductCreateSerializer(serializers.ModelSerializer):
    department = serializers.SlugRelatedField(slug_field="slug", queryset=Department.objects.all())

    class Meta:
        model = Product
        fields = ("name", "code", "unit", "department")


class MaintenanceIncidentSerializer(serializers.ModelSerializer):
    officer_email = serializers.SerializerMethodField()
    officer_display_name = serializers.SerializerMethodField()
    supervisor_display_name = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()

    class Meta:
        model = MaintenanceIncident
        fields = (
            "id",
            "officer",
            "officer_email",
            "officer_display_name",
            "supervisor",
            "supervisor_display_name",
            "vehicle_type",
            "issue_description",
            "status",
            "reported_at",
            "reported_latitude",
            "reported_longitude",
            "breakdown_verified_at",
            "breakdown_verified_latitude",
            "breakdown_verified_longitude",
            "garage_recorded_at",
            "garage_latitude",
            "garage_longitude",
            "released_at",
            "approved_at",
            "rejected_at",
            "supervisor_notes",
            "photos",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "officer",
            "supervisor",
            "reported_at",
            "breakdown_verified_at",
            "garage_recorded_at",
            "released_at",
            "approved_at",
            "rejected_at",
            "created_at",
            "updated_at",
        )

    def get_officer_email(self, obj):
        return obj.officer.email if obj.officer_id else ""

    def get_officer_display_name(self, obj):
        return obj.officer.display_name if obj.officer_id and obj.officer else ""

    def get_supervisor_display_name(self, obj):
        return obj.supervisor.display_name if obj.supervisor_id and obj.supervisor else ""

    def get_photos(self, obj):
        request = self.context.get("request")
        out = []
        for p in (obj.photos.all() if hasattr(obj, "photos") else []):
            if not p.image:
                continue
            url = p.image.url
            if request:
                url = request.build_absolute_uri(url)
            out.append(url)
        return out


class MaintenanceIncidentCreateSerializer(serializers.ModelSerializer):
    photo = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    # Multipart form sends decimals as strings; explicit fields coerce reliably.
    reported_latitude = serializers.DecimalField(
        max_digits=10, decimal_places=7, required=False, allow_null=True
    )
    reported_longitude = serializers.DecimalField(
        max_digits=10, decimal_places=7, required=False, allow_null=True
    )

    class Meta:
        model = MaintenanceIncident
        fields = ("vehicle_type", "issue_description", "reported_latitude", "reported_longitude", "photo")


class MaintenanceIncidentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceIncident
        fields = (
            "status",
            "supervisor_notes",
            "breakdown_verified_latitude",
            "breakdown_verified_longitude",
            "garage_latitude",
            "garage_longitude",
        )
