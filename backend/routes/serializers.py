from rest_framework import serializers

from accounts.models import User
from farmers.models import Farm, Farmer

from .models import Route, RouteReport, RouteStop


class RouteStopSerializer(serializers.ModelSerializer):
    farmer = serializers.UUIDField(source="farmer_id", read_only=True)
    farmer_display_name = serializers.CharField(source="farmer.name", read_only=True)
    farm = serializers.UUIDField(source="farm_id", read_only=True, allow_null=True)
    farm_display_name = serializers.SerializerMethodField()

    class Meta:
        model = RouteStop
        fields = (
            "id",
            "farmer",
            "farmer_display_name",
            "farm",
            "farm_display_name",
            "order",
        )

    def get_farm_display_name(self, obj):
        if obj.farm_id and obj.farm:
            return obj.farm.village
        return None


class RouteStopCreateSerializer(serializers.ModelSerializer):
    farmer_id = serializers.UUIDField(write_only=True)
    farm_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = RouteStop
        fields = ("farmer_id", "farm_id", "order")

    def validate(self, attrs):
        farm_id = attrs.get("farm_id")
        farmer_id = attrs.get("farmer_id")
        if farm_id and farmer_id:
            farm = Farm.objects.filter(pk=farm_id, farmer_id=farmer_id).first()
            if not farm:
                raise serializers.ValidationError(
                    {"farm_id": "Farm must belong to the selected farmer."}
                )
        return attrs

    def create(self, validated_data):
        farmer_id = validated_data.pop("farmer_id")
        farm_id = validated_data.pop("farm_id", None)
        farmer = Farmer.objects.get(pk=farmer_id)
        farm = Farm.objects.get(pk=farm_id) if farm_id else None
        return RouteStop.objects.create(
            route=self.context["route"],
            farmer=farmer,
            farm=farm,
            **validated_data,
        )


class RouteSerializer(serializers.ModelSerializer):
    officer = serializers.UUIDField(source="officer_id", read_only=True)
    officer_email = serializers.EmailField(source="officer.email", read_only=True)
    officer_display_name = serializers.SerializerMethodField()
    stops = RouteStopSerializer(many=True, read_only=True)

    class Meta:
        model = Route
        fields = (
            "id",
            "officer",
            "officer_email",
            "officer_display_name",
            "scheduled_date",
            "name",
            "activity_types",
            "notes",
            "stops",
            "created_at",
            "updated_at",
        )

    def get_officer_display_name(self, obj):
        return obj.officer.display_name if obj.officer_id and getattr(obj, "officer", None) else ""


class RouteCreateSerializer(serializers.ModelSerializer):
    """Create a route (weekly plan day). Officer creates for self; optional stops in same payload or added later."""

    officer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.OFFICER),
        required=False,
        allow_null=True,
    )
    stops = RouteStopCreateSerializer(many=True, required=False, default=list)

    class Meta:
        model = Route
        fields = ("officer", "scheduled_date", "name", "activity_types", "notes", "stops")

    def create(self, validated_data):
        stops_data = validated_data.pop("stops", [])
        user = self.context["request"].user
        if validated_data.get("officer") is None:
            validated_data["officer"] = user
        route = Route.objects.create(**validated_data)
        for i, stop_data in enumerate(stops_data):
            stop_ser = RouteStopCreateSerializer(
                data={**stop_data, "order": stop_data.get("order", i)},
                context={"route": route, "request": self.context["request"]},
            )
            stop_ser.is_valid(raise_exception=True)
            stop_ser.save()
        return route


class RouteUpdateSerializer(serializers.ModelSerializer):
    """Update name, activity_types, notes. Stops updated via separate endpoint or replace list."""

    stops = RouteStopCreateSerializer(many=True, required=False)

    class Meta:
        model = Route
        fields = ("scheduled_date", "name", "activity_types", "notes", "stops")

    def update(self, instance, validated_data):
        stops_data = validated_data.pop("stops", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if stops_data is not None:
            instance.stops.all().delete()
            for i, stop_data in enumerate(stops_data):
                stop_ser = RouteStopCreateSerializer(
                    data={**stop_data, "order": stop_data.get("order", i)},
                    context={"route": instance, "request": self.context["request"]},
                )
                stop_ser.is_valid(raise_exception=True)
                stop_ser.save()
        return instance


class RouteReportSerializer(serializers.ModelSerializer):
    route_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = RouteReport
        fields = ("id", "route_id", "report_data", "submitted_at", "submitted_by", "created_at", "updated_at")
        read_only_fields = ("submitted_at", "submitted_by")


class RouteReportCreateUpdateSerializer(serializers.ModelSerializer):
    """Submit or update route report (report_data). submitted_at/submitted_by set by view."""

    class Meta:
        model = RouteReport
        fields = ("report_data",)
