# Generated migration: server-corrected timestamp for route ordering (timestamp sync)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracking", "0005_tracking_interval_one_minute"),
    ]

    operations = [
        migrations.AddField(
            model_name="locationreport",
            name="reported_at_server",
            field=models.DateTimeField(
                blank=True,
                help_text="reported_at minus device_clock_offset when provided; used for route ordering.",
                null=True,
                verbose_name="Captured (server-corrected)",
            ),
        ),
    ]
