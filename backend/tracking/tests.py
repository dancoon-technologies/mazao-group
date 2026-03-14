"""
Tests for tracking API: batch create location reports, list (admin/supervisor only).
"""

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from locations.models import Region

from .models import LocationReport


class TrackingAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        region = Region.objects.create(name="North")
        self.admin = User.objects.create_user(
            email="admin@test.com", password="admin123", role=User.Role.ADMIN
        )
        self.officer = User.objects.create_user(
            email="officer@test.com",
            password="officer123",
            role=User.Role.OFFICER,
            region_id=region,
        )
        self.supervisor = User.objects.create_user(
            email="super@test.com",
            password="super123",
            role=User.Role.SUPERVISOR,
            region_id=region,
        )

    def _login(self, email, password):
        r = self.client.post(
            "/api/auth/login/", {"email": email, "password": password}, format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.json()["access"]

    def test_batch_create_reports_success(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        now = timezone.now().isoformat()
        payload = {
            "reports": [
                {
                    "reported_at": now,
                    "latitude": -6.0,
                    "longitude": 39.0,
                },
                {
                    "reported_at": now,
                    "latitude": -6.001,
                    "longitude": 39.001,
                    "accuracy": 10.0,
                    "battery_percent": 85.0,
                },
            ]
        }
        r = self.client.post("/api/tracking/reports/batch/", payload, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        data = r.json()
        self.assertEqual(data["created"], 2)
        self.assertEqual(LocationReport.objects.filter(user=self.officer).count(), 2)

    def test_batch_create_invalid_payload_400(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            "/api/tracking/reports/batch/",
            {"reports": "not-a-list"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", r.json())

    def test_batch_create_validation_error_400(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        payload = {
            "reports": [
                {"latitude": -6.0, "longitude": 39.0},
            ]
        }
        r = self.client.post("/api/tracking/reports/batch/", payload, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reported_at", str(r.json()))

    def test_list_reports_admin_200(self):
        LocationReport.objects.create(
            user=self.officer,
            reported_at=timezone.now(),
            latitude=-6.0,
            longitude=39.0,
        )
        token = self._login("admin@test.com", "admin123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/tracking/reports/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("results", r.json())
        self.assertGreaterEqual(len(r.json()["results"]), 1)

    def test_list_reports_officer_403(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/tracking/reports/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_reports_supervisor_200(self):
        token = self._login("super@test.com", "super123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/tracking/reports/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("results", r.json())
