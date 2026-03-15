# Generated migration: device_integrity and integrity_warning for fraud detection

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracking", "0006_reported_at_server"),
    ]

    operations = [
        migrations.AddField(
            model_name="locationreport",
            name="device_integrity",
            field=models.JSONField(
                blank=True,
                help_text="Client-side integrity: mock_provider, rooted, speed_kmh, integrity_flags.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="locationreport",
            name="integrity_warning",
            field=models.CharField(
                blank=True,
                help_text="Server-side fraud flag e.g. impossible_travel, mock_provider.",
                max_length=64,
                null=True,
            ),
        ),
    ]
