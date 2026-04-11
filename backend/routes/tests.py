from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Department, User
from locations.models import Region

from .models import Route, RouteReport


class RouteReportAPITests(TestCase):
    """Route report must be readable/updatable by route owner officer."""

    def setUp(self):
        self.client = APIClient()
        region = Region.objects.create(name="North")
        dept = Department.objects.create(name="Extension Routes", slug="extension-routes")
        self.officer = User.objects.create_user(
            email="officer-routes@test.com",
            password="officer123",
            role=User.Role.OFFICER,
            region_id=region,
            department=dept,
        )
        self.other_officer = User.objects.create_user(
            email="officer-other@test.com",
            password="officer123",
            role=User.Role.OFFICER,
            region_id=region,
            department=dept,
        )
        self.route = Route.objects.create(
            officer=self.officer,
            scheduled_date="2026-03-18",
            name="Wednesday Route",
            activity_types=["farm_to_farm_visits"],
            notes="",
        )

    def _login(self, email: str, password: str) -> str:
        r = self.client.post(
            "/api/auth/login/", {"email": email, "password": password}, format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.json()["access"]

    def test_get_route_report_creates_default_when_missing(self):
        token = self._login("officer-routes@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get(f"/api/routes/{self.route.pk}/report/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.json()["route_id"], str(self.route.pk))
        self.assertEqual(r.json()["report_data"], {})
        self.assertEqual(RouteReport.objects.filter(route=self.route).count(), 1)

    def test_patch_route_report_saves_report_data(self):
        token = self._login("officer-routes@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        payload = {
            "report_data": {
                "visits_count": 4,
                "summary": "Good coverage",
                "products_sold_total": 17,
            }
        }
        r = self.client.patch(
            f"/api/routes/{self.route.pk}/report/",
            payload,
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, msg=r.json())
        self.assertEqual(r.json()["route_id"], str(self.route.pk))
        self.assertEqual(r.json()["report_data"]["visits_count"], 4)
        self.assertEqual(r.json()["report_data"]["products_sold_total"], 17)
        report = RouteReport.objects.get(route=self.route)
        self.assertEqual(report.report_data.get("summary"), "Good coverage")
        self.assertIsNotNone(report.submitted_at)
        self.assertEqual(report.submitted_by_id, self.officer.pk)

    def test_other_officer_cannot_access_route_report(self):
        token = self._login("officer-other@test.com", "officer123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get(f"/api/routes/{self.route.pk}/report/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_supervisor_same_department_can_get_route_report_read_only(self):
        supervisor = User.objects.create_user(
            email="supervisor-routes@test.com",
            password="super123",
            role=User.Role.SUPERVISOR,
            region_id=self.officer.region_id,
            department=self.officer.department,
        )
        token = self._login("supervisor-routes@test.com", "super123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get(f"/api/routes/{self.route.pk}/report/")
        self.assertEqual(r.status_code, status.HTTP_200_OK, msg=r.json())
        self.assertEqual(r.json()["route_id"], str(self.route.pk))

    def test_supervisor_cannot_patch_route_report_for_officer(self):
        supervisor = User.objects.create_user(
            email="supervisor-patch@test.com",
            password="super123",
            role=User.Role.SUPERVISOR,
            region_id=self.officer.region_id,
            department=self.officer.department,
        )
        token = self._login("supervisor-patch@test.com", "super123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.patch(
            f"/api/routes/{self.route.pk}/report/",
            {"report_data": {"remarks": "Should not save"}},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)
