# Append product_lines to ActivityTypeConfig.form_fields when missing (all activity types).

from django.db import migrations

PRODUCT_LINES_FIELD = {"key": "product_lines", "label": "Products", "required": False}


def add_product_lines(apps, schema_editor):
    ActivityTypeConfig = apps.get_model("visits", "ActivityTypeConfig")
    for config in ActivityTypeConfig.objects.all().iterator():
        fields = config.form_fields
        if not isinstance(fields, list):
            fields = []
        keys = {f.get("key") for f in fields if isinstance(f, dict)}
        if "product_lines" in keys:
            continue
        config.form_fields = [*fields, dict(PRODUCT_LINES_FIELD)]
        config.save(update_fields=["form_fields"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0029_maintenance_released_status"),
    ]

    operations = [
        migrations.RunPython(add_product_lines, noop_reverse),
    ]
