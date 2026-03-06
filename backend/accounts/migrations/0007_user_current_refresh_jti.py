# Single device: store current valid refresh token jti so only one login is valid at a time.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_reduce_device_id_length"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="current_refresh_jti",
            field=models.CharField(blank=True, editable=False, max_length=255),
        ),
    ]
