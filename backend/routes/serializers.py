from rest_framework import serializers

from accounts.models import User

from .models import Route, RouteReport


class RouteSerializer(serializers.ModelSerializer):
    """Day plan for an officer; visits are recorded against the route."""

    officer = serializers.UUIDField(source="officer_id", read_only=True)
    officer_email = serializers.EmailField(source="officer.email", read_only=True)
    officer_display_name = serializers.SerializerMethodField()
    approved_by = serializers.UUIDField(source="approved_by_id", read_only=True, allow_null=True)

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
            "status",
            "approved_by",
            "rejection_reason",
            "created_at",
            "updated_at",
        )

    def get_officer_display_name(self, obj):
        return obj.officer.display_name if obj.officer_id and getattr(obj, "officer", None) else ""


class RouteCreateSerializer(serializers.ModelSerializer):
    """Create a route (weekly plan day). Officer creates for self. Visits link to the route when recording."""

    officer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.OFFICER),
        required=False,
        allow_null=True,
    )
    activity_types = serializers.ListField(
        child=serializers.CharField(max_length=80),
        required=False,
        allow_empty=True,
        default=list,
    )
    name = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = Route
        fields = ("officer", "scheduled_date", "name", "activity_types", "notes")

    def create(self, validated_data):
        user = self.context["request"].user
        if validated_data.get("officer") is None:
            validated_data["officer"] = user
        return Route.objects.create(**validated_data)


class RouteUpdateSerializer(serializers.ModelSerializer):
    """Update scheduled_date, name, activity_types, notes."""

    activity_types = serializers.ListField(
        child=serializers.CharField(max_length=80),
        required=False,
        allow_empty=True,
    )
    name = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Route
        fields = ("scheduled_date", "name", "activity_types", "notes")

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class RouteApproveSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("accept", "reject"))
    rejection_reason = serializers.CharField(required=False, allow_blank=True)


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
