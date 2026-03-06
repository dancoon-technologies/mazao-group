# Reduce CharField max_length to save storage; truncate existing data first.

from django.db import migrations, models


def truncate_visit_charfields(apps, schema_editor):
    Visit = apps.get_model("visits", "Visit")
    for obj in Visit.objects.only("id", "photo_device_info", "photo_place_name", "pests_diseases"):
        updated = False
        if obj.photo_device_info and len(obj.photo_device_info) > 120:
            obj.photo_device_info = obj.photo_device_info[:120]
            updated = True
        if obj.photo_place_name and len(obj.photo_place_name) > 120:
            obj.photo_place_name = obj.photo_place_name[:120]
            updated = True
        if obj.pests_diseases and len(obj.pests_diseases) > 180:
            obj.pests_diseases = obj.pests_diseases[:180]
            updated = True
        if updated:
            obj.save(update_fields=["photo_device_info", "photo_place_name", "pests_diseases"])


def truncate_activity_type_labels(apps, schema_editor):
    ActivityTypeConfig = apps.get_model("visits", "ActivityTypeConfig")
    for obj in ActivityTypeConfig.objects.only("id", "label"):
        if obj.label and len(obj.label) > 150:
            obj.label = obj.label[:150]
            obj.save(update_fields=["label"])


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0009_activitytypeconfig_departments_m2m"),
    ]

    operations = [
        migrations.RunPython(truncate_visit_charfields, migrations.RunPython.noop),
        migrations.RunPython(truncate_activity_type_labels, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="activitytypeconfig",
            name="label",
            field=models.CharField(max_length=150),
        ),
        migrations.AlterField(
            model_name="visit",
            name="photo_device_info",
            field=models.CharField(blank=True, help_text="Device model and OS (e.g. iPhone 14, iOS 17).", max_length=120),
        ),
        migrations.AlterField(
            model_name="visit",
            name="photo_place_name",
            field=models.CharField(blank=True, help_text="Place label (e.g. farm village or 'Farmer location').", max_length=120),
        ),
        migrations.AlterField(
            model_name="visit",
            name="pests_diseases",
            field=models.CharField(blank=True, max_length=180),
        ),
    ]
