from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from django.contrib.auth import get_user_model


User = get_user_model()


class SingleDeviceJWTAuthentication(JWTAuthentication):
    """
    Enforce "one user, one active device" by rejecting access tokens that are not
    the most recently issued for the user.

    We only enforce the rule when `user.current_access_jti` is set, so existing
    users without the field populated won't be blocked.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, validated_token = result

        expected_jti = getattr(user, "current_access_jti", "") or ""
        if not expected_jti:
            return user, validated_token

        token_jti = validated_token.get("jti")
        if not token_jti or str(token_jti) != str(expected_jti):
            raise AuthenticationFailed("You are logged in on another device.", code="logged_in_elsewhere")

        return user, validated_token

