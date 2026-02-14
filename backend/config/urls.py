from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("config.api_urls")),
]

if not getattr(settings, "USE_S3", False) and hasattr(settings, "MEDIA_ROOT"):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
