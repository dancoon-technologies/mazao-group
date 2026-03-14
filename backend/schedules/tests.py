"""
Tests for schedules API: list by role, create (officer propose, supervisor create accepted), approve/reject.
"""

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Department, User
from farmers.models import Farmer
from locations.models import Region

from .models import Schedule


def _schedule_list_results(r):
    data = r.json()
    return data.get("results", data) if isinstance(data, dict) and "results" in data else data


class ScheduleAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        region = Region.objects.create(name="North")
        self.dept = Department.objects.create(name="Extension", slug="extension")
        self.admin = User.objects.create_user(
            email="admin@test.com", password="admin123", role=User.Role.ADMIN
        )
        self.officer = User.objects.create_user(
            email="officer@test.com",
            password="officer123",
            role=User.Role.OFFICER,
            region_id=region,
            department=self.dept,
        )
        self.supervisor = User.objects.create_user(
            email="super@test.com",
            password="super123",
            role=User.Role.SUPERVISOR,
            region_id=region,
            department=self.dept,
        )
        self.other_officer = User.objects.create_user(
            email="other@test.com",
            password="other123",
            role=User.Role.OFFICER,
            region_id=region,
            department=self.dept,
        )
        self.farmer = Farmer.objects.create(
            first_name="Test",
            last_name="Farmer",
            phone="+255111",
            latitude=-6.0,
            longitude=39.0,
            assigned_officer=self.officer,
        )

    def _login(self, email, password):
        r = self.client.post(
            "/api/auth/login/", {"email": email, "password": password}, format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.json()["access"]

    def test_officer_sees_only_own_schedules(self):
        Schedule.objects.create(
            created_by=self.officer,
            officer=self.officer,
            farmer=self.farmer,
            scheduled_date=timezone.now().date(),
            status=Schedule.Status.PROPOSED,
        )
        Schedule.objects.create(
            created_by=self.supervisor,
            officer=self.other_officer,
            farmer=self.farmer,
            scheduled_date=timezone.now().date(),
            status=Schedule.Status.ACCEPTED,
            approved_by=self.supervisor,
        )
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/schedules/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        results = _schedule_list_results(r)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["officer"], str(self.officer.pk))

    def test_admin_sees_all_schedules(self):
        Schedule.objects.create(
            created_by=self.officer,
            officer=self.officer,
            farmer=self.farmer,
            scheduled_date=timezone.now().date(),
            status=Schedule.Status.PROPOSED,
        )
        token = self._login("admin@test.com", "admin123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/schedules/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        results = _schedule_list_results(r)
        self.assertGreaterEqual(len(results), 1)

    def test_officer_create_proposed_schedule(self):
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        today = timezone.now().date()
        payload = {
            "farmer": str(self.farmer.pk),
            "scheduled_date": today.isoformat(),
            "notes": "Field visit",
        }
        r = self.client.post("/api/schedules/", payload, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.json()["status"], Schedule.Status.PROPOSED)
        self.assertEqual(r.json()["officer"], str(self.officer.pk))

    def test_supervisor_create_accepted_schedule(self):
        token = self._login("super@test.com", "super123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        today = timezone.now().date()
        payload = {
            "officer": str(self.officer.pk),
            "farmer": str(self.farmer.pk),
            "scheduled_date": today.isoformat(),
            "notes": "Assigned by supervisor",
        }
        r = self.client.post("/api/schedules/", payload, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.json()["status"], Schedule.Status.ACCEPTED)

    def test_supervisor_approve_accept(self):
        schedule = Schedule.objects.create(
            created_by=self.officer,
            officer=self.officer,
            farmer=self.farmer,
            scheduled_date=timezone.now().date(),
            status=Schedule.Status.PROPOSED,
        )
        token = self._login("super@test.com", "super123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            f"/api/schedules/{schedule.pk}/approve/",
            {"action": "accept"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        schedule.refresh_from_db()
        self.assertEqual(schedule.status, Schedule.Status.ACCEPTED)

    def test_supervisor_approve_reject(self):
        schedule = Schedule.objects.create(
            created_by=self.officer,
            officer=self.officer,
            farmer=self.farmer,
            scheduled_date=timezone.now().date(),
            status=Schedule.Status.PROPOSED,
        )
        token = self._login("super@test.com", "super123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            f"/api/schedules/{schedule.pk}/approve/",
            {"action": "reject", "rejection_reason": "Conflict"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        schedule.refresh_from_db()
        self.assertEqual(schedule.status, Schedule.Status.REJECTED)

    def test_officer_cannot_approve_schedule(self):
        schedule = Schedule.objects.create(
            created_by=self.supervisor,
            officer=self.officer,
            farmer=self.farmer,
            scheduled_date=timezone.now().date(),
            status=Schedule.Status.PROPOSED,
        )
        token = self._login("officer@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            f"/api/schedules/{schedule.pk}/approve/",
            {"action": "accept"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_approve_already_accepted_400(self):
        schedule = Schedule.objects.create(
            created_by=self.supervisor,
            officer=self.officer,
            farmer=self.farmer,
            scheduled_date=timezone.now().date(),
            status=Schedule.Status.ACCEPTED,
            approved_by=self.supervisor,
        )
        token = self._login("super@test.com", "super123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            f"/api/schedules/{schedule.pk}/approve/",
            {"action": "accept"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
