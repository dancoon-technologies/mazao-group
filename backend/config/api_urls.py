from django.urls import path

from accounts.auth_views import EmailTokenObtainPairView, SingleDeviceTokenRefreshView
from accounts.views import (
    ChangePasswordView,
    OfficersListView,
    OptionsListView,
    StaffListCreateView,
    StaffPerformanceView,
    StaffResendCredentialsView,
    StaffResetDeviceView,
    StaffUpdateView,
)
from farmers.views import FarmerListCreateView, FarmerRetrieveView, FarmListCreateView, FarmRetrieveView
from locations.views import LocationListView
from tracking.views import (
    LocationReportBatchCreateView,
    LocationReportListCreateView,
    ServerTimeView,
)
from notifications.views import (
    NotificationArchiveView,
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
    NotificationUnreadCountView,
    PushStatusView,
    RegisterPushTokenView,
    TestPushView,
)
from routes.views import (
    RouteListCreateView,
    RouteReportDetailView,
    RouteRetrieveUpdateDestroyView,
)
from schedules.views import ScheduleApproveView, ScheduleListCreateView, ScheduleUpdateView
from visits.dashboard_views import (
    DashboardStatsByDepartmentView,
    DashboardStatsView,
    DashboardProductRankingView,
    DashboardSchedulesSummaryView,
    DashboardStaffRankingView,
    DashboardTopOfficersView,
    DashboardVisitsByActivityView,
    DashboardVisitsByDayView,
)
from visits.views import (
    VisitListCreateView,
    VisitRetrieveView,
    VisitVerifyView,
    ProductListCreateView,
)
from visits.maintenance_views import (
    MaintenanceIncidentListCreateView,
    MaintenanceIncidentUpdateView,
)

urlpatterns = [
    path("auth/login/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", SingleDeviceTokenRefreshView.as_view(), name="token_refresh"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change_password"),
    path("farmers/", FarmerListCreateView.as_view(), name="farmer-list-create"),
    path("farmers/<uuid:pk>/", FarmerRetrieveView.as_view(), name="farmer-retrieve"),
    path("farms/", FarmListCreateView.as_view(), name="farm-list-create"),
    path("farms/<uuid:pk>/", FarmRetrieveView.as_view(), name="farm-retrieve"),
    path("visits/", VisitListCreateView.as_view(), name="visit-list-create"),
    path("visits/<uuid:pk>/", VisitRetrieveView.as_view(), name="visit-retrieve"),
    path("visits/<uuid:pk>/verify/", VisitVerifyView.as_view(), name="visit-verify"),
    path("products/", ProductListCreateView.as_view(), name="product-list-create"),
    path("maintenance-incidents/", MaintenanceIncidentListCreateView.as_view(), name="maintenance-incident-list-create"),
    path("maintenance-incidents/<uuid:pk>/", MaintenanceIncidentUpdateView.as_view(), name="maintenance-incident-update"),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("dashboard/stats-by-department/", DashboardStatsByDepartmentView.as_view(), name="dashboard-stats-by-department"),
    path("dashboard/visits-by-day/", DashboardVisitsByDayView.as_view(), name="dashboard-visits-by-day"),
    path("dashboard/visits-by-activity/", DashboardVisitsByActivityView.as_view(), name="dashboard-visits-by-activity"),
    path("dashboard/top-officers/", DashboardTopOfficersView.as_view(), name="dashboard-top-officers"),
    path("dashboard/product-ranking/", DashboardProductRankingView.as_view(), name="dashboard-product-ranking"),
    path("dashboard/staff-ranking/", DashboardStaffRankingView.as_view(), name="dashboard-staff-ranking"),
    path("dashboard/schedules-summary/", DashboardSchedulesSummaryView.as_view(), name="dashboard-schedules-summary"),
    path("schedules/", ScheduleListCreateView.as_view(), name="schedule-list-create"),
    path("schedules/<uuid:pk>/", ScheduleUpdateView.as_view(), name="schedule-update"),
    path("schedules/<uuid:pk>/approve/", ScheduleApproveView.as_view(), name="schedule-approve"),
    path("routes/", RouteListCreateView.as_view(), name="route-list-create"),
    path("routes/<uuid:pk>/", RouteRetrieveUpdateDestroyView.as_view(), name="route-retrieve-update-destroy"),
    path("routes/<uuid:route_id>/report/", RouteReportDetailView.as_view(), name="route-report-detail"),
    path("staff/performance/", StaffPerformanceView.as_view(), name="staff-performance"),
    path("staff/<uuid:pk>/", StaffUpdateView.as_view(), name="staff-update"),
    path("staff/<uuid:pk>", StaffUpdateView.as_view(), name="staff-update-no-slash"),
    path(
        "staff/<uuid:pk>/resend-credentials/",
        StaffResendCredentialsView.as_view(),
        name="staff-resend-credentials",
    ),
    path(
        "staff/<uuid:pk>/reset-device/",
        StaffResetDeviceView.as_view(),
        name="staff-reset-device",
    ),
    path("staff/", StaffListCreateView.as_view(), name="staff-list-create"),
    path("officers/", OfficersListView.as_view(), name="officers-list"),
    path("locations/", LocationListView.as_view(), name="locations-list"),
    path("tracking/time/", ServerTimeView.as_view(), name="tracking-server-time"),
    path("tracking/reports/", LocationReportListCreateView.as_view(), name="tracking-report-list"),
    path("tracking/reports/batch/", LocationReportBatchCreateView.as_view(), name="tracking-report-batch"),
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
    path(
        "notifications/register-device/",
        RegisterPushTokenView.as_view(),
        name="notification-register-device",
    ),
    path(
        "notifications/push-status/",
        PushStatusView.as_view(),
        name="notification-push-status",
    ),
    path(
        "notifications/test-push/",
        TestPushView.as_view(),
        name="notification-test-push",
    ),
]
