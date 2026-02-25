import logging

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

logger = logging.getLogger(__name__)


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Accept 'email' instead of 'username' for login."""

    username_field = "email"

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["user_id"] = str(user.pk)
        token["email"] = user.email
        token["role"] = user.role
        token["must_change_password"] = getattr(user, "must_change_password", False)
        token["department"] = user.department or ""
        token["department_display"] = user.get_department_display() if user.department else ""
        return token


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
