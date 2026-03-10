from django.urls import path

from accounts.auth_views import EmailTokenObtainPairView, SingleDeviceTokenRefreshView
from accounts.views import (
    ChangePasswordView,
    OfficersListView,
    OptionsListView,
    StaffListCreateView,
    StaffPerformanceView,
    StaffResendCredentialsView,
    StaffUpdateView,
)
from farmers.views import FarmerListCreateView, FarmListCreateView
from locations.views import LocationListView
from notifications.views import (
    NotificationArchiveView,
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
    NotificationUnreadCountView,
)
from schedules.views import ScheduleApproveView, ScheduleListCreateView, ScheduleUpdateView
from visits.dashboard_views import (
    DashboardStatsByDepartmentView,
    DashboardStatsView,
    DashboardSchedulesSummaryView,
    DashboardTopOfficersView,
    DashboardVisitsByActivityView,
    DashboardVisitsByDayView,
)
from visits.views import VisitListCreateView

urlpatterns = [
    path("auth/login/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", SingleDeviceTokenRefreshView.as_view(), name="token_refresh"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change_password"),
    path("farmers/", FarmerListCreateView.as_view(), name="farmer-list-create"),
    path("farms/", FarmListCreateView.as_view(), name="farm-list-create"),
    path("visits/", VisitListCreateView.as_view(), name="visit-list-create"),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("dashboard/stats-by-department/", DashboardStatsByDepartmentView.as_view(), name="dashboard-stats-by-department"),
    path("dashboard/visits-by-day/", DashboardVisitsByDayView.as_view(), name="dashboard-visits-by-day"),
    path("dashboard/visits-by-activity/", DashboardVisitsByActivityView.as_view(), name="dashboard-visits-by-activity"),
    path("dashboard/top-officers/", DashboardTopOfficersView.as_view(), name="dashboard-top-officers"),
    path("dashboard/schedules-summary/", DashboardSchedulesSummaryView.as_view(), name="dashboard-schedules-summary"),
    path("schedules/", ScheduleListCreateView.as_view(), name="schedule-list-create"),
    path("schedules/<uuid:pk>/", ScheduleUpdateView.as_view(), name="schedule-update"),
    path("schedules/<uuid:pk>/approve/", ScheduleApproveView.as_view(), name="schedule-approve"),
    path("staff/performance/", StaffPerformanceView.as_view(), name="staff-performance"),
    path("staff/<uuid:pk>/", StaffUpdateView.as_view(), name="staff-update"),
    path("staff/<uuid:pk>", StaffUpdateView.as_view(), name="staff-update-no-slash"),
    path(
        "staff/<uuid:pk>/resend-credentials/",
        StaffResendCredentialsView.as_view(),
        name="staff-resend-credentials",
    ),
    path("staff/", StaffListCreateView.as_view(), name="staff-list-create"),
    path("officers/", OfficersListView.as_view(), name="officers-list"),
    path("locations/", LocationListView.as_view(), name="locations-list"),
    path("options/", OptionsListView.as_view(), name="options-list"),
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path(
        "notifications/unread-count/",
        NotificationUnreadCountView.as_view(),
        name="notification-unread-count",
    ),
    path(
        "notifications/mark-all-read/",
        NotificationMarkAllReadView.as_view(),
        name="notification-mark-all-read",
    ),
    path(
        "notifications/<uuid:pk>/read/",
        NotificationMarkReadView.as_view(),
        name="notification-mark-read",
    ),
    path(
        "notifications/<uuid:pk>/archive/",
        NotificationArchiveView.as_view(),
        name="notification-archive",
    ),
]
