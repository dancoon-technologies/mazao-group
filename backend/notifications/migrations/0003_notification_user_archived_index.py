# Index for notification list and unread count

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0002_notification_archived_at"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["user", "archived_at"], name="notif_user_archived"),
        ),
    ]
