# Data migration: set interval_minutes=1 so mobile tracks every minute (was 10 from 0004).

from django.db import migrations


def set_interval_one_minute(apps, schema_editor):
    TrackingSettings = apps.get_model("tracking", "TrackingSettings")
    TrackingSettings.objects.update(interval_minutes=1)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tracking", "0004_trackingsettings_interval_minutes"),
    ]

    operations = [
        migrations.RunPython(set_interval_one_minute, noop),
    ]
