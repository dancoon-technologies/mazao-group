"""
Kenya locations: Region → County → SubCounty.
Stored by ID only; minimal storage.
"""

from django.db import models


class Region(models.Model):
    """Former province (e.g. Central, Coast)."""
    name = models.CharField(max_length=50, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class County(models.Model):
    """County (47 in Kenya)."""
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name="counties")
    name = models.CharField(max_length=80)

    class Meta:
        ordering = ["name"]
        unique_together = [["region", "name"]]

    def __str__(self):
        return self.name


class SubCounty(models.Model):
    """Sub-county within a county."""
    county = models.ForeignKey(County, on_delete=models.CASCADE, related_name="sub_counties")
    name = models.CharField(max_length=80)

    class Meta:
        ordering = ["name"]
        unique_together = [["county", "name"]]
        verbose_name_plural = "Sub-counties"

    def __str__(self):
        return self.name
