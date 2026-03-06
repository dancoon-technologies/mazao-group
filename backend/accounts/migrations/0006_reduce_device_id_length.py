# Reduce User.device_id max_length; truncate existing data first.

from django.db import migrations, models


def truncate_device_ids(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for obj in User.objects.only("id", "device_id").filter(device_id__isnull=False).exclude(device_id=""):
        if len(obj.device_id) > 128:
            obj.device_id = obj.device_id[:128]
            obj.save(update_fields=["device_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_user_department_fk"),
    ]

    operations = [
        migrations.RunPython(truncate_device_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="device_id",
            field=models.CharField(blank=True, max_length=128),
        ),
    ]
