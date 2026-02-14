"""
Tests for auth: login with email, refresh token.
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from .models import User


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
