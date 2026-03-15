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
            {"email": "user@test.com", "password": "pass123"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        data = r.json()
        self.assertIn("access", data)
        self.assertIn("refresh", data)
        self.assertTrue(len(data["access"]) > 0)
        self.assertTrue(len(data["refresh"]) > 0)

    def test_login_wrong_password_401(self):
        r = self.client.post(
            "/api/auth/login/",
            {"email": "user@test.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_unknown_email_401(self):
        r = self.client.post(
            "/api/auth/login/",
            {"email": "unknown@test.com", "password": "pass123"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_returns_new_access(self):
        r = self.client.post(
            "/api/auth/login/",
            {"email": "user@test.com", "password": "pass123"},
            format="json",
        )
        refresh = r.json()["refresh"]
        r2 = self.client.post("/api/auth/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertIn("access", r2.json())

    def test_protected_endpoint_without_token_401(self):
        r = self.client.get("/api/farmers/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_email_case_insensitive(self):
        """Login works with different email casing (normalized)."""
        r = self.client.post(
            "/api/auth/login/",
            {"email": "USER@TEST.COM", "password": "pass123"},
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
            {"email": "user@test.com", "password": "pass123"},
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
            {"email": "user@test.com", "password": "pass123"},
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
            "/api/auth/login/", {"email": email, "password": password}, format="json"
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
