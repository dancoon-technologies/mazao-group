"""
Tests for farmers API: list by role (admin all, officer assigned only, supervisor by region).
"""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from locations.models import Region

from .models import Farmer


class FarmersAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        region_north = Region.objects.create(name="North")
        region_south = Region.objects.create(name="South")
        self.admin = User.objects.create_user(
            email="admin@test.com", password="admin123", role=User.Role.ADMIN
        )
        self.officer = User.objects.create_user(
            email="officer@test.com",
            password="officer123",
            role=User.Role.OFFICER,
            region_id=region_north,
        )
        self.supervisor = User.objects.create_user(
            email="super@test.com",
            password="super123",
            role=User.Role.SUPERVISOR,
            region_id=region_north,
        )
        self.farmer_assigned = Farmer.objects.create(
            first_name="My",
            last_name="Farmer",
            phone="+255111",
            latitude=-6.0,
            longitude=39.0,
            assigned_officer=self.officer,
        )
        self.other_officer = User.objects.create_user(
            email="other@test.com",
            password="other123",
            role=User.Role.OFFICER,
            region_id=region_south,
        )
        self.farmer_other = Farmer.objects.create(
            first_name="Other",
            last_name="Farmer",
            phone="+255222",
            latitude=-6.01,
            longitude=39.01,
            assigned_officer=self.other_officer,
        )
        self.farmer_unassigned = Farmer.objects.create(
            first_name="Unassigned",
            last_name="Farmer",
            phone="+255333",
            latitude=-6.02,
            longitude=39.02,
            assigned_officer=None,
        )

    def _login(self, email, password):
        r = self.client.post(
            "/api/auth/login/", {"email": email, "password": password}, format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.json()["access"]

    def _farmer_list_results(self, r):
        """Return list of farmers from response (handles paginated or plain list)."""
        data = r.json()
        return data.get("results", data) if isinstance(data, dict) and "results" in data else data

    def test_admin_sees_all_farmers(self):
        token = self._login("admin@test.com", "admin123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/farmers/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        results = self._farmer_list_results(r)
        self.assertEqual(len(results), 3)

    def test_officer_sees_only_assigned_farmers(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/farmers/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        results = self._farmer_list_results(r)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["display_name"], "My Farmer")

    def test_supervisor_sees_farmers_in_region(self):
        token = self._login("super@test.com", "super123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/farmers/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        # North region: officer is North, other_officer is South -> only farmer_assigned
        results = self._farmer_list_results(r)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["display_name"], "My Farmer")

    def test_farmer_list_search(self):
        token = self._login("admin@test.com", "admin123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/farmers/?search=My")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        results = self._farmer_list_results(r)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["display_name"], "My Farmer")

    def test_create_farmer_as_admin_with_assignment(self):
        token = self._login("admin@test.com", "admin123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        payload = {
            "first_name": "New",
            "last_name": "Partner",
            "phone": "+255444",
            "latitude": -6.03,
            "longitude": 39.03,
            "assigned_officer": str(self.officer.pk),
        }
        r = self.client.post("/api/farmers/", payload, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        data = r.json()
        self.assertEqual(data["display_name"], "New Partner")
        self.assertEqual(data["assigned_officer"], str(self.officer.pk))
        self.assertEqual(Farmer.objects.count(), 4)

    def test_create_farmer_as_officer_auto_assigns_self(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        payload = {
            "first_name": "Officer",
            "last_name": "Created",
            "phone": "+255555",
            "latitude": -6.04,
            "longitude": 39.04,
        }
        r = self.client.post("/api/farmers/", payload, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.json()["assigned_officer"], str(self.officer.pk))
        results = self._farmer_list_results(
            self.client.get("/api/farmers/")
        )
        self.assertEqual(len(results), 2)

    def test_create_farmer_validation_required_fields(self):
        token = self._login("admin@test.com", "admin123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post("/api/farmers/", {"first_name": "Only"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        errors = r.json()
        self.assertTrue(errors)
        self.assertTrue("last_name" in errors or "phone" in errors)
