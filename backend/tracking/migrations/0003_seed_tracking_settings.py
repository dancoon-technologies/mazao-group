# Data migration: create one TrackingSettings row so admin can edit working hours

from django.db import migrations


def create_tracking_settings(apps, schema_editor):
    TrackingSettings = apps.get_model("tracking", "TrackingSettings")
    if not TrackingSettings.objects.exists():
        TrackingSettings.objects.create(
            working_hour_start=6,
            working_hour_end=18,
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tracking", "0002_trackingsettings"),
    ]

    operations = [
        migrations.RunPython(create_tracking_settings, noop),
    ]
