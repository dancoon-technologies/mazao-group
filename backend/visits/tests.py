"""
Tests for visits: Haversine, create visit (GPS, photo, assignment), list, dashboard.
"""

import json
from io import BytesIO

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Department, User
from farmers.models import Farmer
from locations.models import Region

from django.utils import timezone
from datetime import timedelta

from schedules.models import Schedule
from routes.models import Route

from .models import Product, Visit, VisitProduct
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
        )
        today = timezone.now().date()
        self.schedule = Schedule.objects.create(
            created_by=self.admin,
            officer=self.officer,
            farmer=self.farmer,
            scheduled_date=today,
            status=Schedule.Status.ACCEPTED,
        )
        self.schedule_officer_other_farmer = Schedule.objects.create(
            created_by=self.admin,
            officer=self.officer,
            farmer=self.farmer_other,
            scheduled_date=today,
            status=Schedule.Status.ACCEPTED,
        )

    def _login(self, email, password):
        r = self.client.post(
            "/api/auth/login/", {"email": email, "password": password}, format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.json()["access"]

    def _visit_list_results(self, r):
        """Return list of visits from response (handles paginated or plain list)."""
        data = r.json()
        return data.get("results", data) if isinstance(data, dict) and "results" in data else data

    def test_create_visit_success_within_100m(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        # Officer at same location as farmer
        data = {
            "farmer_id": str(self.farmer.pk),
            "schedule_id": str(self.schedule.pk),
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
            "schedule_id": str(self.schedule.pk),
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
            "schedule_id": str(self.schedule.pk),
            "latitude": -6.0,
            "longitude": 39.0,
        }
        r = self.client.post("/api/visits/", data, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("photo", r.json())

    def test_create_visit_officer_can_record_for_any_farmer(self):
        """Any officer can record a visit for any farmer (no assignment required)."""
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        data = {
            "farmer_id": str(self.farmer_other.pk),
            "schedule_id": str(self.schedule_officer_other_farmer.pk),
            "latitude": -6.01,
            "longitude": 39.01,
        }
        photo = make_jpeg_file()
        r = self.client.post("/api/visits/", {**data, "photo": photo}, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Visit.objects.count(), 1)

    def test_create_visit_farmer_not_found(self):
        import uuid

        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        data = {
            "farmer_id": str(uuid.uuid4()),
            "schedule_id": str(self.schedule.pk),
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
        results = self._visit_list_results(r)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["officer"], str(self.officer.pk))

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
        self.assertEqual(len(self._visit_list_results(r)), 1)

    def test_list_visits_filter_by_date(self):
        visit = Visit.objects.create(
            officer=self.officer,
            farmer=self.farmer,
            latitude=-6.0,
            longitude=39.0,
            distance_from_farmer=0,
            verification_status=Visit.VerificationStatus.VERIFIED,
        )
        # Pin created_at to a known date so date filter matches in all timezones/CI
        today = timezone.now().date()
        naive_noon = timezone.datetime(today.year, today.month, today.day, 12, 0, 0)
        visit.created_at = timezone.make_aware(naive_noon) if timezone.is_naive(naive_noon) else naive_noon
        visit.save(update_fields=["created_at"])
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        date_str = today.isoformat()
        r = self.client.get(f"/api/visits/?date={date_str}")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(self._visit_list_results(r)), 1)

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

    def test_dashboard_staff_ranking_uses_photo_taken_at_for_date_window(self):
        """
        Staff ranking should use the device timestamp (photo_taken_at) instead of created_at.
        This matters for offline usage: visits may be synced later, but should still count in the
        correct reporting window.
        """
        today = timezone.now().date()
        naive_device_noon = timezone.datetime(today.year, today.month, today.day, 12, 0, 0)
        device_ts = timezone.make_aware(naive_device_noon) if timezone.is_naive(naive_device_noon) else naive_device_noon

        visit = Visit.objects.create(
            officer=self.officer,
            farmer=self.farmer,
            latitude=-6.0,
            longitude=39.0,
            distance_from_farmer=0,
            notes="",
            photo_device_info="test-device",
            photo_place_name="Test place",
            photo_taken_at=device_ts,
            verification_status=Visit.VerificationStatus.VERIFIED,
            activity_type="order_collection",
            activity_types=["order_collection"],
        )
        # Make created_at fall outside the 30-day reporting window.
        visit.created_at = timezone.now() - timedelta(days=90)
        visit.save(update_fields=["created_at"])

        token = self._login("admin@test.com", "admin123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/dashboard/staff-ranking/?days=30")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        data = r.json()
        self.assertTrue(isinstance(data, list))
        match = next((x for x in data if str(x.get("officer_id")) == str(self.officer.pk)), None)
        self.assertIsNotNone(match, "Expected officer to appear in staff ranking")
        self.assertEqual(match.get("accepted_visits_recorded"), 1)
        self.assertEqual(match.get("collections_done"), 1)

    def test_retrieve_visit_officer_sees_own(self):
        visit = Visit.objects.create(
            officer=self.officer,
            farmer=self.farmer,
            schedule=self.schedule,
            latitude=-6.0,
            longitude=39.0,
            distance_from_farmer=0,
            verification_status=Visit.VerificationStatus.PENDING,
        )
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get(f"/api/visits/{visit.pk}/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.json()["id"], str(visit.pk))

    def test_retrieve_visit_admin_sees_any(self):
        visit = Visit.objects.create(
            officer=self.other_officer,
            farmer=self.farmer_other,
            latitude=-6.01,
            longitude=39.01,
            distance_from_farmer=0,
            verification_status=Visit.VerificationStatus.PENDING,
        )
        token = self._login("admin@test.com", "admin123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get(f"/api/visits/{visit.pk}/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_retrieve_visit_officer_cannot_see_other_404(self):
        visit = Visit.objects.create(
            officer=self.other_officer,
            farmer=self.farmer_other,
            latitude=-6.01,
            longitude=39.01,
            distance_from_farmer=0,
            verification_status=Visit.VerificationStatus.PENDING,
        )
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get(f"/api/visits/{visit.pk}/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_visit_schedule_not_found_400(self):
        import uuid

        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        data = {
            "farmer_id": str(self.farmer.pk),
            "schedule_id": str(uuid.uuid4()),
            "latitude": -6.0,
            "longitude": 39.0,
        }
        photo = make_jpeg_file()
        r = self.client.post("/api/visits/", {**data, "photo": photo}, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("schedule_id", r.json())


class VisitVerifyAPITests(TestCase):
    """Verify endpoint: supervisor/admin accept or reject; officer forbidden. Requires same department."""

    def setUp(self):
        self.client = APIClient()
        region = Region.objects.create(name="North")
        dept = Department.objects.create(name="Extension", slug="extension")
        self.admin = User.objects.create_user(
            email="admin@test.com", password="admin123", role=User.Role.ADMIN
        )
        self.officer = User.objects.create_user(
            email="officer@test.com",
            password="officer123",
            role=User.Role.OFFICER,
            region_id=region,
            department=dept,
        )
        self.supervisor = User.objects.create_user(
            email="super@test.com",
            password="super123",
            role=User.Role.SUPERVISOR,
            region_id=region,
            department=dept,
        )
        self.farmer = Farmer.objects.create(
            first_name="Test",
            last_name="Farmer",
            phone="+255111",
            latitude=-6.0,
            longitude=39.0,
        )
        self.schedule = Schedule.objects.create(
            created_by=self.admin,
            officer=self.officer,
            farmer=self.farmer,
            scheduled_date=timezone.now().date(),
            status=Schedule.Status.ACCEPTED,
        )

    def _login(self, email, password):
        r = self.client.post(
            "/api/auth/login/", {"email": email, "password": password}, format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.json()["access"]

    def test_verify_accept(self):
        visit = Visit.objects.create(
            officer=self.officer,
            farmer=self.farmer,
            schedule=self.schedule,
            latitude=-6.0,
            longitude=39.0,
            distance_from_farmer=0,
            verification_status=Visit.VerificationStatus.PENDING,
        )
        token = self._login("super@test.com", "super123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            f"/api/visits/{visit.pk}/verify/",
            {"action": "accept"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        visit.refresh_from_db()
        self.assertEqual(visit.verification_status, Visit.VerificationStatus.VERIFIED)

    def test_verify_reject(self):
        visit = Visit.objects.create(
            officer=self.officer,
            farmer=self.farmer,
            schedule=self.schedule,
            latitude=-6.0,
            longitude=39.0,
            distance_from_farmer=0,
            verification_status=Visit.VerificationStatus.PENDING,
        )
        token = self._login("super@test.com", "super123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            f"/api/visits/{visit.pk}/verify/",
            {"action": "reject"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        visit.refresh_from_db()
        self.assertEqual(visit.verification_status, Visit.VerificationStatus.REJECTED)

    def test_verify_officer_forbidden(self):
        visit = Visit.objects.create(
            officer=self.officer,
            farmer=self.farmer,
            schedule=self.schedule,
            latitude=-6.0,
            longitude=39.0,
            distance_from_farmer=0,
            verification_status=Visit.VerificationStatus.PENDING,
        )
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            f"/api/visits/{visit.pk}/verify/",
            {"action": "accept"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)


class VisitProductLinesAPITests(TestCase):
    """Create visit with product_lines; list/retrieve include product_lines."""

    def setUp(self):
        import json as _json

        self.json = _json
        self.client = APIClient()
        region = Region.objects.create(name="North")
        # Use unique slug to avoid UNIQUE constraint with VisitVerifyAPITests when tests run in parallel
        dept = Department.objects.create(name="Extension Product", slug="extension-pl")
        self.admin = User.objects.create_user(
            email="admin@test.com", password="admin123", role=User.Role.ADMIN
        )
        self.officer = User.objects.create_user(
            email="officer@test.com",
            password="officer123",
            role=User.Role.OFFICER,
            region_id=region,
            department=dept,
        )
        self.farmer = Farmer.objects.create(
            first_name="Test",
            last_name="Farmer",
            phone="+255111",
            latitude=-6.0,
            longitude=39.0,
        )
        self.schedule = Schedule.objects.create(
            created_by=self.admin,
            officer=self.officer,
            farmer=self.farmer,
            scheduled_date=timezone.now().date(),
            status=Schedule.Status.ACCEPTED,
        )
        self.route = Route.objects.create(
            officer=self.officer,
            scheduled_date=timezone.now().date(),
            name="Route A",
            activity_types=["farm_to_farm_visits"],
            notes="",
        )
        self.product = Product.objects.create(
            department=dept,
            name="Seeds A",
            code="SA01",
            unit="kg",
        )

    def _login(self, email, password):
        r = self.client.post(
            "/api/auth/login/", {"email": email, "password": password}, format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.json()["access"]

    def test_create_visit_with_product_lines(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        product_lines = [
            {"product_id": str(self.product.pk), "quantity_sold": 10},
        ]
        data = {
            "farmer_id": str(self.farmer.pk),
            "schedule_id": str(self.schedule.pk),
            "latitude": -6.0,
            "longitude": 39.0,
            "notes": "Visit with sales",
            "product_lines": json.dumps(product_lines),
        }
        photo = make_jpeg_file()
        r = self.client.post("/api/visits/", {**data, "photo": photo}, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Visit.objects.count(), 1)
        self.assertEqual(VisitProduct.objects.count(), 1)
        resp = r.json()
        self.assertIn("product_lines", resp)
        self.assertEqual(len(resp["product_lines"]), 1)
        self.assertEqual(resp["product_lines"][0]["product_id"], str(self.product.pk))
        self.assertEqual(resp["product_lines"][0]["product_name"], "Seeds A")
        # Serializer may return Decimal as "10" or "10.000"
        self.assertEqual(float(resp["product_lines"][0]["quantity_sold"]), 10)
        self.assertNotIn("quantity_given", resp["product_lines"][0])

    def test_retrieve_visit_includes_product_lines(self):
        visit = Visit.objects.create(
            officer=self.officer,
            farmer=self.farmer,
            schedule=self.schedule,
            latitude=-6.0,
            longitude=39.0,
            distance_from_farmer=0,
            verification_status=Visit.VerificationStatus.VERIFIED,
        )
        VisitProduct.objects.create(
            visit=visit,
            product=self.product,
            quantity_sold=5,
            quantity_given=1,
        )
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get(f"/api/visits/{visit.pk}/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("product_lines", r.json())
        lines = r.json()["product_lines"]
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0]["product_name"], "Seeds A")
        # Serializer returns Decimal as string (e.g. "5.000" with decimal_places=3)
        self.assertEqual(float(lines[0]["quantity_sold"]), 5)
        self.assertNotIn("quantity_given", lines[0])

    def test_create_route_only_visit_with_product_lines(self):
        """
        Route-based visit should work without schedule_id and still persist product_lines.
        Guards mobile flow: record from weekly route stop.
        """
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        product_lines = [
            {"product_id": str(self.product.pk), "quantity_sold": 7},
        ]
        data = {
            "farmer_id": str(self.farmer.pk),
            "route_id": str(self.route.pk),
            "latitude": -6.0,
            "longitude": 39.0,
            "notes": "Route-only visit with sales",
            "product_lines": json.dumps(product_lines),
        }
        photo = make_jpeg_file()
        r = self.client.post("/api/visits/", {**data, "photo": photo}, format="multipart")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, msg=r.json())
        self.assertEqual(Visit.objects.count(), 1)
        self.assertEqual(VisitProduct.objects.count(), 1)
        visit = Visit.objects.first()
        self.assertIsNotNone(visit)
        self.assertEqual(str(visit.route_id), str(self.route.pk))
        self.assertIsNone(visit.schedule_id)
        self.assertIn("product_lines", r.json())
        self.assertEqual(len(r.json()["product_lines"]), 1)
        self.assertEqual(float(r.json()["product_lines"][0]["quantity_sold"]), 7)
        self.assertNotIn("quantity_given", r.json()["product_lines"][0])
