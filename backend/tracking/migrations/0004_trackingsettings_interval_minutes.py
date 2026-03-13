# Add interval_minutes to TrackingSettings

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tracking", "0003_seed_tracking_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="trackingsettings",
            name="interval_minutes",
            field=models.PositiveSmallIntegerField(
                default=10,
                help_text="Minutes between location reports during working hours (e.g. 10 = every 10 min).",
            ),
        ),
    ]
