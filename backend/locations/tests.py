"""
Tests for locations API: GET returns regions, counties, sub_counties.
"""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import County, Region, SubCounty


class LocationAPITests(TestCase):
    """Use unique names not in locations seed migration (Central, Coast, etc.) to avoid UNIQUE constraint."""

    def setUp(self):
        self.client = APIClient()
        self.region, _ = Region.objects.get_or_create(
            name="LocationsTestRegion", defaults={"name": "LocationsTestRegion"}
        )
        self.county, _ = County.objects.get_or_create(
            region=self.region,
            name="LocationsTestCounty",
            defaults={"region": self.region, "name": "LocationsTestCounty"},
        )
        self.sub_county, _ = SubCounty.objects.get_or_create(
            county=self.county,
            name="LocationsTestSubCounty",
            defaults={"county": self.county, "name": "LocationsTestSubCounty"},
        )

    def test_locations_list_structure(self):
        r = self.client.get("/api/locations/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        data = r.json()
        self.assertIn("regions", data)
        self.assertIn("counties", data)
        self.assertIn("sub_counties", data)

    def test_locations_list_returns_data(self):
        r = self.client.get("/api/locations/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        data = r.json()
        region_names = [rg["name"] for rg in data["regions"]]
        self.assertIn("LocationsTestRegion", region_names)
        county_names = [c["name"] for c in data["counties"]]
        self.assertIn("LocationsTestCounty", county_names)
        sub_names = [s["name"] for s in data["sub_counties"]]
        self.assertIn("LocationsTestSubCounty", sub_names)

    def test_locations_no_auth_required(self):
        r = self.client.get("/api/locations/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
