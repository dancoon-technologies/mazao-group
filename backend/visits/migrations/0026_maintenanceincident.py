from django.db import migrations, models
import django.db.models.deletion
import uuid
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0025_add_visit_route_fk"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MaintenanceIncident",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("vehicle_type", models.CharField(choices=[("motorbike", "Motorbike"), ("car", "Car"), ("other", "Other")], max_length=20)),
                ("issue_description", models.CharField(max_length=1000)),
                ("status", models.CharField(choices=[("reported", "Reported"), ("verified_breakdown", "Verified breakdown"), ("at_garage", "At garage"), ("approved", "Approved"), ("rejected", "Rejected")], default="reported", max_length=30)),
                ("reported_at", models.DateTimeField(auto_now_add=True)),
                ("reported_latitude", models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True)),
                ("reported_longitude", models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True)),
                ("breakdown_verified_at", models.DateTimeField(blank=True, null=True)),
                ("breakdown_verified_latitude", models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True)),
                ("breakdown_verified_longitude", models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True)),
                ("garage_recorded_at", models.DateTimeField(blank=True, null=True)),
                ("garage_latitude", models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True)),
                ("garage_longitude", models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("rejected_at", models.DateTimeField(blank=True, null=True)),
                ("supervisor_notes", models.CharField(blank=True, max_length=1000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("officer", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="maintenance_incidents_reported", to=settings.AUTH_USER_MODEL)),
                ("supervisor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="maintenance_incidents_reviewed", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-reported_at", "-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="maintenanceincident",
            index=models.Index(fields=["status"], name="maint_status_idx"),
        ),
        migrations.AddIndex(
            model_name="maintenanceincident",
            index=models.Index(fields=["officer", "-reported_at"], name="maint_officer_reported_idx"),
        ),
    ]
