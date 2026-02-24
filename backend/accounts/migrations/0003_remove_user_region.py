# Remove legacy CharField region; use region_id only

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_location_ids"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="user",
            name="region",
        ),
    ]
