# Reduce Notification title max_length; truncate existing data first.

from django.db import migrations, models


def truncate_titles(apps, schema_editor):
    Notification = apps.get_model("notifications", "Notification")
    for obj in Notification.objects.only("id", "title").filter(title__isnull=False):
        if len(obj.title) > 120:
            obj.title = obj.title[:120]
            obj.save(update_fields=["title"])


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0003_notification_user_archived_index"),
    ]

    operations = [
        migrations.RunPython(truncate_titles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="notification",
            name="title",
            field=models.CharField(max_length=120),
        ),
    ]
