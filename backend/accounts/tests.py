"""
Tests for auth: login with email, refresh token; options API.
"""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import Department, User


class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="user@test.com",
            password="pass123",
            role=User.Role.OFFICER,
        )

    def test_login_success_returns_tokens(self):
        r = self.client.post(
            "/api/auth/login/",
            {"email": "user@test.com", "password": "pass123", "device_id": "device-a"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        data = r.json()
        self.assertIn("access", data)
        self.assertIn("refresh", data)
        self.assertTrue(len(data["access"]) > 0)
        self.assertTrue(len(data["refresh"]) > 0)

    def test_login_saves_app_client_meta(self):
        r = self.client.post(
            "/api/auth/login/",
            {
                "email": "user@test.com",
                "password": "pass123",
                "device_id": "device-a",
                "app_version": "2.1.0",
                "app_native_build": "99",
                "app_update_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                "app_update_channel": "preview",
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.app_client_version, "2.1.0")
        self.assertEqual(self.user.app_native_build, "99")
        self.assertEqual(self.user.app_update_id, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
        self.assertEqual(self.user.app_update_channel, "preview")
        self.assertIsNotNone(self.user.app_client_reported_at)

    def test_refresh_saves_app_client_meta(self):
        r = self.client.post(
            "/api/auth/login/",
            {"email": "user@test.com", "password": "pass123", "device_id": "device-a"},
            format="json",
        )
        refresh = r.json()["refresh"]
        r2 = self.client.post(
            "/api/auth/refresh/",
            {
                "refresh": refresh,
                "app_version": "3.0.0",
                "app_update_id": "new-ota-id",
            },
            format="json",
        )
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.app_client_version, "3.0.0")
        self.assertEqual(self.user.app_update_id, "new-ota-id")

    def test_login_wrong_password_401(self):
        r = self.client.post(
            "/api/auth/login/",
            {"email": "user@test.com", "password": "wrong", "device_id": "device-a"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_unknown_email_401(self):
        r = self.client.post(
            "/api/auth/login/",
            {"email": "unknown@test.com", "password": "pass123", "device_id": "device-a"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_returns_new_access(self):
        r = self.client.post(
            "/api/auth/login/",
            {"email": "user@test.com", "password": "pass123", "device_id": "device-a"},
            format="json",
        )
        refresh = r.json()["refresh"]
        r2 = self.client.post("/api/auth/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertIn("access", r2.json())

    def test_protected_endpoint_without_token_401(self):
        r = self.client.get("/api/farmers/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_bound_device_can_login_and_get_tokens(self):
        r1 = self.client.post(
            "/api/auth/login/",
            {"email": "user@test.com", "password": "pass123", "device_id": "device-a"},
            format="json",
        )
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.device_id, "device-a")

    def test_login_rejected_when_device_changes(self):
        self.user.device_id = "device-a"
        self.user.save(update_fields=["device_id"])
        r = self.client.post(
            "/api/auth/login/",
            {"email": "user@test.com", "password": "pass123", "device_id": "device-b"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("another device", str(r.json().get("detail", "")).lower())

    def test_login_rejected_when_bound_account_has_no_device_id(self):
        self.user.device_id = "device-a"
        self.user.save(update_fields=["device_id"])
        r = self.client.post(
            "/api/auth/login/",
            {"email": "user@test.com", "password": "pass123"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("device identification", str(r.json().get("detail", "")).lower())

    def test_login_email_case_insensitive(self):
        """Login works with different email casing (normalized)."""
        r = self.client.post(
            "/api/auth/login/",
            {"email": "USER@TEST.COM", "password": "pass123", "device_id": "device-a"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("access", r.json())

    def test_refresh_invalid_token_401(self):
        r = self.client.post(
            "/api/auth/refresh/",
            {"refresh": "invalid.jwt.token"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_change_password_success(self):
        r = self.client.post(
            "/api/auth/login/",
            {"email": "user@test.com", "password": "pass123", "device_id": "device-a"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        token = r.json()["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r2 = self.client.post(
            "/api/auth/change-password/",
            {"current_password": "pass123", "new_password": "newpass456"},
            format="json",
        )
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertIn("access", r2.json())
        self.assertIn("Password changed successfully", r2.json().get("detail", ""))

    def test_change_password_wrong_current_400(self):
        r = self.client.post(
            "/api/auth/login/",
            {"email": "user@test.com", "password": "pass123", "device_id": "device-a"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
        r2 = self.client.post(
            "/api/auth/change-password/",
            {"current_password": "wrong", "new_password": "newpass456"},
            format="json",
        )
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", r2.json())

    def test_change_password_missing_fields_400(self):
        r = self.client.post(
            "/api/auth/login/",
            {"email": "user@test.com", "password": "pass123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
        r2 = self.client.post(
            "/api/auth/change-password/",
            {},
            format="json",
        )
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)


class OptionsAPITests(TestCase):
    """GET /api/options/ returns option sets (departments, activity_types, products by department)."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="user@test.com",
            password="pass123",
            role=User.Role.OFFICER,
        )

    def _login(self, email, password):
        r = self.client.post(
            "/api/auth/login/", {"email": email, "password": password, "device_id": "device-a"}, format="json"
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.json()["access"]

    def test_options_requires_auth(self):
        r = self.client.get("/api/options/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_options_returns_structure(self):
        token = self._login("user@test.com", "pass123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/options/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        data = r.json()
        self.assertIn("departments", data)
        self.assertIn("staff_roles", data)
        self.assertIn("activity_types", data)
        self.assertIn("products", data)
        self.assertIn("labels", data)
        self.assertIn("visit_settings", data)
        self.assertIn("tracking_settings", data)
        self.assertIsInstance(data["activity_types"], list)
        self.assertIsInstance(data["products"], list)

    def test_options_returns_products_when_user_has_department(self):
        # Use unique slug so we don't conflict with migration-seeded "agriprice"
        dept, _ = Department.objects.get_or_create(
            slug="options-test-dept",
            defaults={"name": "Options Test Dept"},
        )
        user_dept = User.objects.create_user(
            email="dept@test.com",
            password="pass123",
            role=User.Role.OFFICER,
            department=dept,
        )
        from visits.models import Product

        product = Product.objects.create(
            department=dept,
            name="Test Product",
            code="TP01",
            unit="kg",
        )
        token = self._login("dept@test.com", "pass123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/options/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        products = r.json()["products"]
        self.assertEqual(len(products), 1)
        self.assertEqual(products[0]["name"], "Test Product")
        self.assertEqual(products[0]["id"], str(product.pk))
        self.assertEqual(products[0]["code"], "TP01")
        self.assertEqual(products[0]["unit"], "kg")


class StaffPortalExcludesDjangoAdminUsersTests(TestCase):
    """Field-staff APIs must not list or mutate users with Django admin flags (is_staff / is_superuser)."""

    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(slug="staff-filter-dept", name="Staff Filter Dept")
        self.admin = User.objects.create_user(
            email="portal-admin@test.com",
            password="pass123",
            role=User.Role.ADMIN,
        )
        self.officer = User.objects.create_user(
            email="field-officer@test.com",
            password="pass123",
            role=User.Role.OFFICER,
            department=self.dept,
        )
        self.supervisor_portal = User.objects.create_user(
            email="supervisor-portal@test.com",
            password="pass123",
            role=User.Role.SUPERVISOR,
            department=self.dept,
        )
        self.supervisor_django = User.objects.create_user(
            email="supervisor-django@test.com",
            password="pass123",
            role=User.Role.SUPERVISOR,
            department=self.dept,
            is_staff=True,
        )

    def _admin_token(self):
        r = self.client.post(
            "/api/auth/login/",
            {"email": "portal-admin@test.com", "password": "pass123", "device_id": "admin-device"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.json()["access"]

    def test_staff_list_excludes_is_staff_supervisor(self):
        token = self._admin_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/staff/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        data = r.json()
        rows = data["results"] if isinstance(data, dict) and "results" in data else data
        emails = [row["email"] for row in rows]
        self.assertIn("field-officer@test.com", emails)
        self.assertIn("supervisor-portal@test.com", emails)
        self.assertNotIn("supervisor-django@test.com", emails)

    def test_staff_get_detail_returns_404_for_is_staff_user(self):
        token = self._admin_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get(f"/api/staff/{self.supervisor_django.id}/")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)


class StaffResetDeviceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept_a = Department.objects.create(slug="dept-a", name="Dept A")
        self.dept_b = Department.objects.create(slug="dept-b", name="Dept B")
        self.admin = User.objects.create_user(
            email="admin@test.com",
            password="pass123",
            role=User.Role.ADMIN,
        )
        self.supervisor = User.objects.create_user(
            email="supervisor@test.com",
            password="pass123",
            role=User.Role.SUPERVISOR,
            department=self.dept_a,
        )
        self.officer_a = User.objects.create_user(
            email="officer-a@test.com",
            password="pass123",
            role=User.Role.OFFICER,
            department=self.dept_a,
            device_id="device-a",
            current_access_jti="access-a",
            current_refresh_jti="refresh-a",
        )
        self.officer_b = User.objects.create_user(
            email="officer-b@test.com",
            password="pass123",
            role=User.Role.OFFICER,
            department=self.dept_b,
            device_id="device-b",
        )

    def _login(self, email, password):
        r = self.client.post(
            "/api/auth/login/",
            {"email": email, "password": password, "device_id": "caller-device"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.json()["access"]

    def test_admin_can_reset_staff_device_binding(self):
        token = self._login("admin@test.com", "pass123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(f"/api/staff/{self.officer_a.id}/reset-device/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.officer_a.refresh_from_db()
        self.assertEqual(self.officer_a.device_id, "")
        self.assertEqual(self.officer_a.current_access_jti, "")
        self.assertEqual(self.officer_a.current_refresh_jti, "")

    def test_supervisor_can_reset_same_department_staff(self):
        token = self._login("supervisor@test.com", "pass123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(f"/api/staff/{self.officer_a.id}/reset-device/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.officer_a.refresh_from_db()
        self.assertEqual(self.officer_a.device_id, "")

    def test_supervisor_cannot_reset_other_department_staff(self):
        token = self._login("supervisor@test.com", "pass123")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(f"/api/staff/{self.officer_b.id}/reset-device/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
