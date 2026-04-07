from rest_framework import serializers

from accounts.models import User
from farmers.models import Farm, Farmer

from .models import Schedule


class ScheduleSerializer(serializers.ModelSerializer):
    created_by = serializers.UUIDField(source="created_by_id", read_only=True)
    officer = serializers.UUIDField(source="officer_id", read_only=True)
    officer_email = serializers.EmailField(source="officer.email", read_only=True)
    officer_display_name = serializers.SerializerMethodField()
    farmer = serializers.UUIDField(source="farmer_id", read_only=True, allow_null=True)
    farmer_display_name = serializers.CharField(
        source="farmer.name", read_only=True, allow_null=True
    )
    farm = serializers.UUIDField(source="farm_id", read_only=True, allow_null=True)
    farm_display_name = serializers.SerializerMethodField()

    approved_by = serializers.UUIDField(source="approved_by_id", read_only=True, allow_null=True)

    class Meta:
        model = Schedule
        fields = (
            "id",
            "created_by",
            "officer",
            "officer_email",
            "officer_display_name",
            "farmer",
            "farmer_display_name",
            "farm",
            "farm_display_name",
            "scheduled_date",
            "notes",
            "status",
            "approved_by",
            "rejection_reason",
            "edit_reason",
            "created_at",
        )

    def get_officer_display_name(self, obj):
        return obj.officer.display_name if obj.officer_id and getattr(obj, "officer", None) else ""

    def get_farm_display_name(self, obj):
        if obj.farm_id and getattr(obj, "farm", None):
            return obj.farm.village
        return "None"


class ScheduleCreateSerializer(serializers.ModelSerializer):
    """Admin/supervisor: pass officer, farmer, farm, date, notes. Officer: pass farmer, farm, date, notes (officer=self)."""

    officer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.OFFICER),
        required=False,
        allow_null=True,
    )
    farmer = serializers.PrimaryKeyRelatedField(
        queryset=Farmer.objects.all(), required=True, allow_null=False
    )
    farm = serializers.PrimaryKeyRelatedField(
        queryset=Farm.objects.all(), required=True, allow_null=False
    )

    class Meta:
        model = Schedule
        extra_kwargs = {"notes": {"max_length": 2000}}
        fields = ("officer", "farmer", "farm", "scheduled_date", "notes")

    def validate(self, attrs):
        if attrs.get("farmer") is None:
            raise serializers.ValidationError({"farmer": "Farmer is required."})
        if attrs.get("farm") is None:
            raise serializers.ValidationError({"farm": "Farm/outlet is required."})
        farm = attrs.get("farm")
        farmer = attrs.get("farmer")
        if farm is not None and (farmer is None or farm.farmer_id != farmer.id):
            raise serializers.ValidationError(
                {"farm": "Farm must belong to the selected farmer."}
            )
        return attrs


class ScheduleUpdateSerializer(serializers.ModelSerializer):
    """Partial update: proposed (officer/supervisor) or accepted (officer only, requires edit_reason → proposed)."""

    edit_reason = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1000,
        help_text="Required when an officer edits their own schedule (including accepted).",
    )
    officer = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.OFFICER),
        required=False,
        allow_null=True,
    )
    farmer = serializers.PrimaryKeyRelatedField(
        queryset=Farmer.objects.all(), required=False, allow_null=True
    )
    farm = serializers.PrimaryKeyRelatedField(
        queryset=Farm.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Schedule
        extra_kwargs = {"notes": {"max_length": 2000}}
        fields = ("officer", "farmer", "farm", "scheduled_date", "notes", "edit_reason")

    def validate(self, attrs):
        farmer = attrs.get("farmer", getattr(self.instance, "farmer", None))
        farm = attrs.get("farm", getattr(self.instance, "farm", None))
        if farmer is None:
            raise serializers.ValidationError({"farmer": "Farmer is required."})
        if farm is None:
            raise serializers.ValidationError({"farm": "Farm/outlet is required."})
        if farm.farmer_id != farmer.id:
            raise serializers.ValidationError(
                {"farm": "Farm must belong to the selected farmer."}
            )
        return attrs
