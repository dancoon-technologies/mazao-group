# Generated migration: LocationReport only. TrackingSettings added in 0002.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="LocationReport",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                (
                    "reported_at",
                    models.DateTimeField(
                        help_text="Device timestamp when the location was captured (ISO from mobile)."
                    ),
                ),
                ("latitude", models.DecimalField(decimal_places=7, max_digits=10)),
                ("longitude", models.DecimalField(decimal_places=7, max_digits=10)),
                (
                    "accuracy",
                    models.FloatField(
                        blank=True,
                        help_text="Accuracy radius in meters if provided by device.",
                        null=True,
                    ),
                ),
                (
                    "battery_percent",
                    models.FloatField(
                        blank=True,
                        help_text="Device battery level 0–100 at time of report.",
                        null=True,
                    ),
                ),
                (
                    "device_info",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Device model, OS, app version, etc.",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="location_reports",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-reported_at"],
                "indexes": [
                    models.Index(
                        fields=["user", "-reported_at"],
                        name="track_report_user_time",
                    ),
                    models.Index(fields=["-reported_at"], name="track_report_time"),
                ],
            },
        ),
    ]
