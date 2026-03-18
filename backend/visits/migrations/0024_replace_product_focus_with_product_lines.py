# Replace product_focus with product_lines in ActivityTypeConfig.form_fields.

from django.db import migrations


def replace_product_focus_in_form_fields(apps, schema_editor):
    ActivityTypeConfig = apps.get_model("visits", "ActivityTypeConfig")
    for config in ActivityTypeConfig.objects.all():
        if not config.form_fields:
            continue
        updated = False
        new_fields = []
        for f in config.form_fields:
            if isinstance(f, dict) and f.get("key") == "product_focus":
                new_fields.append({"key": "product_lines", "label": "Products", "required": f.get("required", False)})
                updated = True
            else:
                new_fields.append(f)
        if updated:
            config.form_fields = new_fields
            config.save(update_fields=["form_fields"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0023_remove_visit_product_focus_ids"),
    ]

    operations = [
        migrations.RunPython(replace_product_focus_in_form_fields, noop_reverse),
    ]
