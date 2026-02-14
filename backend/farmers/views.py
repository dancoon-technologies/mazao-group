from rest_framework import generics
from .models import Farmer
from .serializers import FarmerSerializer


class FarmerListView(generics.ListAPIView):
    """List farmers. Admin: all. Officer: only assigned."""
    serializer_class = FarmerSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return Farmer.objects.all().select_related("assigned_officer")
        if user.role == "supervisor":
            return Farmer.objects.filter(assigned_officer__region=user.region).select_related("assigned_officer")
        # officer: only assigned
        return Farmer.objects.filter(assigned_officer=user).select_related("assigned_officer")
