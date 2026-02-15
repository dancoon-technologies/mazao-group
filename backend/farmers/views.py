from rest_framework import generics
from .models import Farmer
from .serializers import FarmerSerializer, FarmerCreateSerializer


class FarmerListCreateView(generics.ListCreateAPIView):
    """List farmers. Admin: all. Officer: only assigned. Create: authenticated users."""
    list_serializer_class = FarmerSerializer
    create_serializer_class = FarmerCreateSerializer

    def get_serializer_class(self):
        if self.request.method == "POST":
            return self.create_serializer_class
        return self.list_serializer_class

    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return Farmer.objects.all().select_related("assigned_officer")
        if user.role == "supervisor":
            return Farmer.objects.filter(assigned_officer__region=user.region).select_related("assigned_officer")
        return Farmer.objects.filter(assigned_officer=user).select_related("assigned_officer")

    def perform_create(self, serializer):
        user = self.request.user
        data = serializer.validated_data
        assigned = data.get("assigned_officer")
        if user.role == "officer" and not assigned:
            farmer = serializer.save(assigned_officer=user)
        else:
            farmer = serializer.save()
        if getattr(farmer, "assigned_officer", None) and farmer.assigned_officer != user:
            from notifications.services import notify_user
            notify_user(
                farmer.assigned_officer,
                title="New farmer assigned to you",
                message=f"A new farmer has been assigned to you: {farmer.name}.",
                channels=["in_app", "email", "sms"],
            )
