# Generated migration for TrackingSettings

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracking", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TrackingSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("working_hour_start", models.PositiveSmallIntegerField(default=6, help_text="Start of working hours (0–23). Mobile collects location from this hour inclusive.")),
                ("working_hour_end", models.PositiveSmallIntegerField(default=18, help_text="End of working hours (0–23). Mobile collects until this hour exclusive.")),
            ],
            options={
                "verbose_name": "Tracking settings",
                "verbose_name_plural": "Tracking settings",
            },
        ),
    ]
