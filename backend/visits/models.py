import uuid

from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models

from farmers.models import Farm, Farmer
from mobile_sync.models import MobileSyncModel

# Max lengths for text fields to cap storage (no 100KB notes)
NOTES_MAX_LENGTH = 2000
FEEDBACK_MAX_LENGTH = 2000


class ActivityTypeConfig(models.Model):
    """
    Activity types for visits, configurable in admin. Linked to departments via FK:
    empty departments = visible to all; otherwise only to listed departments.
    """

    value = models.SlugField(max_length=50, unique=True)
    label = models.CharField(max_length=150)
    departments = models.ManyToManyField(
        "accounts.Department",
        blank=True,
        related_name="activity_type_configs",
        help_text="Leave empty = visible to all departments; otherwise only these.",
    )
    order = models.PositiveIntegerField(default=0, help_text="Display order in mobile")

    class Meta:
        ordering = ["order", "label"]

    def __str__(self):
        return self.label


class Visit(MobileSyncModel):
    class VerificationStatus(models.TextChoices):
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"

    class ActivityType(models.TextChoices):
        ORDER_COLLECTION = "order_collection", "Order collection"
        DEBT_COLLECTIONS = "debt_collections", "Debt collections"
        ACCOUNT_OPENING = "account_opening", "Account opening"
        FARM_TO_FARM_VISITS = "farm_to_farm_visits", "Farm to farm visits"
        KEY_FARM_VISITS = "key_farm_visits", "Key farm visits"
        GROUP_TRAINING = "group_training", "Group training"
        COMMON_INTEREST_GROUP_TRAINING = (
            "common_interest_group_training",
            "Common Interest Group training",
        )
        STAKEHOLDER_GROUP_TRAINING = "stakeholder_group_training", "Stakeholder group training"
        EXHIBITION = "exhibition", "Exhibition"
        MARKET_DAY_ACTIVATION = "market_day_activation", "Market day activation"
        MARKET_SURVEY = "market_survey", "Market survey"
        COMPETITION_INTELLIGENCE = "competition_intelligence", "Competition intelligence gathering"
        REPORTING = "reporting", "Reporting"
        DEMO_SET_UP = "demo_set_up", "Demo set up"
        SPOT_DEMO = "spot_demo", "Spot demo"
        DEMO_SITE_TRAINING = "demo_site_training", "Demo site training"
        STAKEHOLDER_ENGAGEMENT = "stakeholder_engagement", "Stakeholder engagement"
        FARMERS_COOPERATIVE_ENGAGEMENT = (
            "farmers_cooperative_engagement",
            "Farmers Cooperative society engagement",
        )
        STOCKISTS_ACTIVATION = "stockists_activation", "Stockists activation"
        MERCHANDISING = "merchandising", "Merchandising"
        ROUTE_STORMING = "route_storming", "Route storming"
        FARMING_POCKET_STORMING = "farming_pocket_storming", "Farming pocket storming"
        COUNTER_STAFF_TRAINING = "counter_staff_training", "Counter staff training"
        COUNTER_STAFF_BONDING = "counter_staff_bonding", "Counter staff bonding session"
        KEY_FARMERS_BONDING = (
            "key_farmers_bonding",
            "Key Farmers bonding session / Goat eating sessions",
        )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="visits",
    )
    farmer = models.ForeignKey(Farmer, on_delete=models.CASCADE, related_name="visits")
    farm = models.ForeignKey(
        Farm,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="visits",
    )
    schedule = models.ForeignKey(
        "schedules.Schedule",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="visits",
    )
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    photo = models.ImageField(upload_to="visits/%Y/%m/", blank=True)
    photo_taken_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Device timestamp when the photo was captured (ISO from mobile).",
    )
    photo_device_info = models.CharField(
        max_length=120,
        blank=True,
        help_text="Device model and OS (e.g. iPhone 14, iOS 17).",
    )
    photo_place_name = models.CharField(
        max_length=120,
        blank=True,
        help_text="Place label (e.g. farm village or 'Farmer location').",
    )
    notes = models.TextField(blank=True, validators=[MaxLengthValidator(NOTES_MAX_LENGTH)])
    distance_from_farmer = models.FloatField(null=True, blank=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.VERIFIED,
    )
    activity_type = models.CharField(
        max_length=50,
        default=ActivityType.FARM_TO_FARM_VISITS,
        help_text="Value from ActivityTypeConfig (filtered by officer department).",
    )
    crop_stage = models.CharField(max_length=100, blank=True)
    germination_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    survival_rate = models.CharField(max_length=50, blank=True)
    pests_diseases = models.CharField(max_length=180, blank=True)
    order_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    harvest_kgs = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    farmers_feedback = models.TextField(blank=True, validators=[MaxLengthValidator(FEEDBACK_MAX_LENGTH)])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["officer", "-created_at"], name="visit_officer_created"),
        ]

    def __str__(self):
        return f"{self.officer.email} @ {self.farmer.name} ({self.created_at})"
