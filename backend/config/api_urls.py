from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from accounts.auth_views import EmailTokenObtainPairView
from farmers.views import FarmerListView
from visits.views import VisitListCreateView
from visits.dashboard_views import DashboardStatsView

urlpatterns = [
    path("auth/login/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("farmers/", FarmerListView.as_view(), name="farmer-list"),
    path("visits/", VisitListCreateView.as_view(), name="visit-list-create"),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
]
