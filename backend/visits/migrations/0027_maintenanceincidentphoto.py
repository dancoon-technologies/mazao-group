from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0026_maintenanceincident"),
    ]

    operations = [
        migrations.CreateModel(
            name="MaintenanceIncidentPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="maintenance/%Y/%m/%d")),
                ("order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "incident",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="photos",
                        to="visits.maintenanceincident",
                    ),
                ),
            ],
            options={
                "ordering": ["order", "created_at", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="maintenanceincidentphoto",
            index=models.Index(fields=["incident"], name="maint_photo_incident_idx"),
        ),
    ]
