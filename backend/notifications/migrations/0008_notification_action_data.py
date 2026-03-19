from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0007_alter_notification_message"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="action_data",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
