import logging

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

logger = logging.getLogger(__name__)
User = get_user_model()


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Accept 'email' instead of 'username' for login. Enforces one device: save refresh jti on user.
    Normalizes email (strip + Django normalize_email) so login works regardless of casing/spaces."""

    username_field = "email"

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["user_id"] = str(user.pk)
        token["email"] = user.email
        token["role"] = user.role
        token["role_display"] = dict(user.Role.choices).get(user.role, user.role)
        token["must_change_password"] = getattr(user, "must_change_password", False)
        token["department"] = user.department.slug if user.department else ""
        token["department_display"] = user.get_department_display()
        token["display_name"] = (user.display_name or user.email) or ""
        token["region_display"] = user.get_region_display() or ""
        return token

    def validate(self, attrs):
        # Normalize email and match case-insensitively so login works regardless of casing/spaces
        # (fixes mobile "no account with given credentials" when account exists).
        raw = (attrs.get("email") or "").strip()
        if raw:
            normalized = User.objects.normalize_email(raw)
            user = User.objects.filter(email__iexact=normalized).first()
            attrs = {**attrs, "email": user.email if user else normalized}
        data = super().validate(attrs)
        # Single device: only this refresh token is valid until next login.
        refresh = self.get_token(self.user)
        jti = refresh.get("jti")
        if jti:
            User.objects.filter(pk=self.user.pk).update(current_refresh_jti=jti)
        return data


class SingleDeviceTokenRefreshSerializer(TokenRefreshSerializer):
    """Reject refresh if the token is not the current one. Return new tokens with full claims so
    the web /api/auth/me can decode email/role from the access token after refresh."""

    def validate(self, attrs):
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework.exceptions import AuthenticationFailed

        refresh_str = attrs.get("refresh")
        try:
            refresh = RefreshToken(refresh_str)
        except Exception:
            return super().validate(attrs)  # Let parent raise proper validation error
        jti = refresh.get("jti")
        user_id = refresh.get("user_id")
        if not jti or not user_id:
            return super().validate(attrs)
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return super().validate(attrs)
        if user.current_refresh_jti != jti:
            logger.info("Token refresh rejected: user=%s logged in on another device", user_id)
            raise AuthenticationFailed(
                "You are logged in on another device. Please log in again.",
                code="logged_in_elsewhere",
            )
        # Issue new tokens with full claims (email, role, must_change_password, etc.) so
        # the Next.js /api/auth/me can read user from the access token without 401.
        new_refresh = EmailTokenObtainPairSerializer.get_token(user)
        new_jti = new_refresh.get("jti")
        if new_jti:
            user.current_refresh_jti = new_jti
            user.save(update_fields=["current_refresh_jti"])
        return {
            "access": str(new_refresh.access_token),
            "refresh": str(new_refresh),
        }


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
            if response.status_code == 200:
                email = request.data.get("email", "")
                logger.info("POST /api/auth/login/ success email=%s", email)
            return response
        except Exception as e:
            logger.warning("POST /api/auth/login/ failed email=%s: %s", request.data.get("email", ""), e)
            raise


class SingleDeviceTokenRefreshView(TokenRefreshView):
    """Refresh tokens only if this device is still the current session (one device at a time)."""
    serializer_class = SingleDeviceTokenRefreshSerializer
