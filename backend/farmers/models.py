import uuid

from django.db import models


class Farmer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=50, blank=True)
    # When true this record represents a stockist rather than a traditional farmer.
    is_stockist = models.BooleanField(default=False)
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    @property
    def name(self):
        """Display name: First Middle Last."""
        parts = [p for p in (self.first_name, self.middle_name, self.last_name) if p]
        return " ".join(parts) if parts else ""

    def __str__(self):
        return self.name


class Farm(models.Model):
    """One piece of farming land belonging to a farmer. A farmer can have more than one."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    farmer = models.ForeignKey(
        Farmer,
        on_delete=models.CASCADE,
        related_name="farms",
    )
    region_id = models.ForeignKey(
        "locations.Region",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        db_column="region_id",
    )
    county_id = models.ForeignKey(
        "locations.County",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        db_column="county_id",
    )
    sub_county_id = models.ForeignKey(
        "locations.SubCounty",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        db_column="sub_county_id",
    )
    village = models.CharField(max_length=100)
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    plot_size = models.CharField(max_length=50, blank=True)  # e.g. "2 acres"
    crop_type = models.CharField(max_length=100, blank=True)
    # When true this location is an outlet/shop rather than a traditional farm.
    is_outlet = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.farmer.name} — {self.village}, {self.sub_county_id.name}"
