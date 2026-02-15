from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from accounts.auth_views import EmailTokenObtainPairView
from accounts.views import StaffListCreateView, StaffResendCredentialsView, OfficersListView, ChangePasswordView
from farmers.views import FarmerListCreateView
from visits.views import VisitListCreateView
from visits.dashboard_views import DashboardStatsView
from schedules.views import ScheduleListCreateView
from notifications.views import (
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    NotificationUnreadCountView,
)

urlpatterns = [
    path("auth/login/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change_password"),
    path("farmers/", FarmerListCreateView.as_view(), name="farmer-list-create"),
    path("visits/", VisitListCreateView.as_view(), name="visit-list-create"),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("schedules/", ScheduleListCreateView.as_view(), name="schedule-list-create"),
    path("staff/<uuid:pk>/resend-credentials/", StaffResendCredentialsView.as_view(), name="staff-resend-credentials"),
    path("staff/", StaffListCreateView.as_view(), name="staff-list-create"),
    path("officers/", OfficersListView.as_view(), name="officers-list"),
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/unread-count/", NotificationUnreadCountView.as_view(), name="notification-unread-count"),
    path("notifications/mark-all-read/", NotificationMarkAllReadView.as_view(), name="notification-mark-all-read"),
    path("notifications/<uuid:pk>/read/", NotificationMarkReadView.as_view(), name="notification-mark-read"),
]
