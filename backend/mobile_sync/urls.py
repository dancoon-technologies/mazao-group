from django.urls import path
from .views import MobileSyncPushView, MobileSyncPullView

urlpatterns = [
    path('push/', MobileSyncPushView.as_view(), name='mobile-sync-push'),
    path('pull/', MobileSyncPullView.as_view(), name='mobile-sync-pull'),
]
