"""
Tests for farmers API: list by role (admin all, officer assigned only, supervisor by region).
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User
from .models import Farmer


class FarmersAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="admin@test.com", password="admin123", role=User.Role.ADMIN
        )
        self.officer = User.objects.create_user(
            email="officer@test.com", password="officer123", role=User.Role.OFFICER, region="North"
        )
        self.supervisor = User.objects.create_user(
            email="super@test.com", password="super123", role=User.Role.SUPERVISOR, region="North"
        )
        self.farmer_assigned = Farmer.objects.create(
            name="My Farmer",
            phone="+255111",
            latitude=-6.0,
            longitude=39.0,
            assigned_officer=self.officer,
        )
        self.other_officer = User.objects.create_user(
            email="other@test.com", password="other123", role=User.Role.OFFICER, region="South"
        )
        self.farmer_other = Farmer.objects.create(
            name="Other Farmer",
            phone="+255222",
            latitude=-6.01,
            longitude=39.01,
            assigned_officer=self.other_officer,
        )
        self.farmer_unassigned = Farmer.objects.create(
            name="Unassigned",
            phone="+255333",
            latitude=-6.02,
            longitude=39.02,
            assigned_officer=None,
        )

    def _login(self, email, password):
        r = self.client.post("/api/auth/login/", {"email": email, "password": password}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.json()["access"]

    def test_admin_sees_all_farmers(self):
        token = self._login("admin@test.com", "admin123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/farmers/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.json()), 3)

    def test_officer_sees_only_assigned_farmers(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/farmers/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.json()), 1)
        self.assertEqual(r.json()[0]["name"], "My Farmer")

    def test_supervisor_sees_farmers_in_region(self):
        token = self._login("super@test.com", "super123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/farmers/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        # North region: officer is North, other_officer is South -> only farmer_assigned
        self.assertEqual(len(r.json()), 1)
        self.assertEqual(r.json()[0]["name"], "My Farmer")
