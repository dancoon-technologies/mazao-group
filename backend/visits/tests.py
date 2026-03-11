"""
Tests for visits: Haversine, create visit (GPS, photo, assignment), list, dashboard.
"""

from io import BytesIO

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from farmers.models import Farmer
from locations.models import Region

from django.utils import timezone
from datetime import timedelta

from .models import Visit
from .utils import (
    MAX_VISIT_DISTANCE_METERS,
    check_travel_from_last_visit,
    haversine_meters,
)


def make_jpeg_file(name="photo.jpg", size_kb=1):
    """Minimal valid JPEG for upload tests."""
    from PIL import Image

    img = Image.new("RGB", (10, 10), color="red")
    buf = BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    content = buf.read()
    if size_kb > 1:
        content = content + b"\x00" * ((size_kb * 1024) - len(content))
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(name, content[: size_kb * 1024], content_type="image/jpeg")


class HaversineTests(TestCase):
    def test_same_point_zero_distance(self):
        self.assertAlmostEqual(haversine_meters(0, 0, 0, 0), 0, places=0)

    def test_known_distance_roughly(self):
        # Same lat, 1 degree longitude at equator ~ 111km
        d = haversine_meters(0, 0, 0, 1)
        self.assertGreater(d, 110_000)
        self.assertLess(d, 112_000)

    def test_within_100m(self):
        # ~50m north: 50/111320 meters per degree lat
        lat1, lon1 = -6.0, 39.0
        lat2 = -6.0 + (50 / 111320)
        d = haversine_meters(lat1, lon1, lat2, lon1)
        self.assertLess(d, 100)
        self.assertGreater(d, 40)

    def test_over_100m_rejected(self):
        lat1, lon1 = -6.0, 39.0
        lat2 = -6.0 + (200 / 111320)  # ~200m
        d = haversine_meters(lat1, lon1, lat2, lon1)
        self.assertGreater(d, MAX_VISIT_DISTANCE_METERS)


class TravelValidationTests(TestCase):
    """Tests for check_travel_from_last_visit (impossible location within time window)."""

    def setUp(self):
        from accounts.models import User
        from farmers.models import Farmer
        from locations.models import Region

        region = Region.objects.create(name="North")
        self.officer = User.objects.create_user(
            email="officer@test.com",
            password="officer123",
            role=User.Role.OFFICER,
            region_id=region,
        )
        self.farmer = Farmer.objects.create(
            first_name="Test",
            last_name="Farmer",
            phone="+255111",
            latitude=-6.0,
            longitude=39.0,
            assigned_officer=self.officer,
        )

    def test_no_previous_visit_allowed(self):
        err, extra = check_travel_from_last_visit(
            self.officer.pk, -6.0, 39.0, window_hours=2.0, max_speed_kmh=120.0
        )
        self.assertIsNone(err)
        self.assertIsNone(extra)

    def test_far_location_within_window_rejected(self):
        # First visit at Thika-ish (-1.0, 37.0). Then "record" at Naivasha-ish (-0.7, 36.4) ~100km in "same minute".
        Visit.objects.create(
            officer=self.officer,
            farmer=self.farmer,
            latitude=-1.0,
            longitude=37.0,
            notes="",
            distance_from_farmer=0,
        )
        # ~100 km away, 0 minutes: would require infinite speed
        err, extra = check_travel_from_last_visit(
            self.officer.pk, -0.7, 36.4, window_hours=2.0, max_speed_kmh=120.0
        )
        self.assertIsNotNone(err)
        self.assertIn("rejected", err.lower())
        self.assertIsNotNone(extra)
        self.assertIn("distance_km", extra)

    def test_old_previous_visit_ignored(self):
        Visit.objects.create(
            officer=self.officer,
            farmer=self.farmer,
            latitude=-1.0,
            longitude=37.0,
            notes="",
            distance_from_farmer=0,
        )
        # Backdate the visit to 3 hours ago
        Visit.objects.filter(officer=self.officer).update(
            created_at=timezone.now() - timedelta(hours=3)
        )
        err, extra = check_travel_from_last_visit(
            self.officer.pk, -0.7, 36.4, window_hours=2.0, max_speed_kmh=120.0
        )
        self.assertIsNone(err)
        self.assertIsNone(extra)


class VisitAPITests(TestCase):
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
        self.farmer = Farmer.objects.create(
            first_name="Test",
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

    def _login(self, email, password):
        r = self.client.post(
            "/api/auth/login/", {"email": email, "password": password}, format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.json()["access"]

    def test_create_visit_success_within_100m(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        # Officer at same location as farmer
        data = {
            "farmer_id": str(self.farmer.pk),
            "latitude": -6.0,
            "longitude": 39.0,
            "notes": "Visit done",
        }
        photo = make_jpeg_file()
        r = self.client.post("/api/visits/", {**data, "photo": photo}, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.json()["verification_status"], "pending")
        self.assertIn("id", r.json())
        self.assertIsNotNone(r.json().get("distance_from_farmer"))
        self.assertEqual(Visit.objects.count(), 1)

    def test_create_visit_rejected_over_100m(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        # Move officer ~500m away (roughly 0.0045 deg lat)
        data = {
            "farmer_id": str(self.farmer.pk),
            "latitude": -6.0 + 0.005,
            "longitude": 39.0,
            "notes": "Far away",
        }
        photo = make_jpeg_file()
        r = self.client.post("/api/visits/", {**data, "photo": photo}, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("100m", r.json().get("detail", ""))
        self.assertEqual(Visit.objects.count(), 0)

    def test_create_visit_photo_required(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        data = {
            "farmer_id": str(self.farmer.pk),
            "latitude": -6.0,
            "longitude": 39.0,
        }
        r = self.client.post("/api/visits/", data, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("photo", r.json())

    def test_create_visit_officer_not_assigned_forbidden(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        # Try to visit farmer assigned to other_officer
        data = {
            "farmer_id": str(self.farmer_other.pk),
            "latitude": -6.01,
            "longitude": 39.01,
        }
        photo = make_jpeg_file()
        r = self.client.post("/api/visits/", {**data, "photo": photo}, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Visit.objects.count(), 0)

    def test_create_visit_farmer_not_found(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        import uuid

        data = {
            "farmer_id": str(uuid.uuid4()),
            "latitude": -6.0,
            "longitude": 39.0,
        }
        photo = make_jpeg_file()
        r = self.client.post("/api/visits/", {**data, "photo": photo}, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_visits_officer_sees_only_own(self):
        Visit.objects.create(
            officer=self.officer,
            farmer=self.farmer,
            latitude=-6.0,
            longitude=39.0,
            distance_from_farmer=0,
            verification_status=Visit.VerificationStatus.VERIFIED,
        )
        Visit.objects.create(
            officer=self.other_officer,
            farmer=self.farmer_other,
            latitude=-6.01,
            longitude=39.01,
            distance_from_farmer=0,
            verification_status=Visit.VerificationStatus.VERIFIED,
        )
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/visits/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.json()), 1)
        self.assertEqual(r.json()[0]["officer"], str(self.officer.pk))

    def test_list_visits_admin_sees_all(self):
        Visit.objects.create(
            officer=self.officer,
            farmer=self.farmer,
            latitude=-6.0,
            longitude=39.0,
            distance_from_farmer=0,
            verification_status=Visit.VerificationStatus.VERIFIED,
        )
        token = self._login("admin@test.com", "admin123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/visits/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.json()), 1)

    def test_list_visits_filter_by_date(self):
        Visit.objects.create(
            officer=self.officer,
            farmer=self.farmer,
            latitude=-6.0,
            longitude=39.0,
            distance_from_farmer=0,
            verification_status=Visit.VerificationStatus.VERIFIED,
        )
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        from django.utils import timezone

        today = timezone.now().date().isoformat()
        r = self.client.get(f"/api/visits/?date={today}")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.json()), 1)

    def test_dashboard_stats_admin_ok(self):
        token = self._login("admin@test.com", "admin123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/dashboard/stats/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("visits_today", r.json())
        self.assertIn("visits_this_month", r.json())
        self.assertIn("active_officers", r.json())

    def test_dashboard_stats_supervisor_ok(self):
        token = self._login("super@test.com", "super123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/dashboard/stats/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_dashboard_stats_officer_forbidden(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/dashboard/stats/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
