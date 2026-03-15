# Seed "Stockists visit" activity for AgriPrice department with form fields.

from django.db import migrations


STOCKISTS_VISIT_FORM_FIELDS = [
    {"key": "number_of_stockists_visited", "label": "Number of Stockists visited", "required": False},
    {"key": "product_focus", "label": "Product focus", "required": False},
    {"key": "order_value", "label": "Total Sales done", "required": False},
    {"key": "merchandising", "label": "Merchandising", "required": False},
    {"key": "counter_training", "label": "Counter training", "required": False},
]


def seed_stockists_visit_activity(apps, schema_editor):
    ActivityTypeConfig = apps.get_model("visits", "ActivityTypeConfig")
    Department = apps.get_model("accounts", "Department")

    try:
        agriprice = Department.objects.get(slug="agriprice")
    except Department.DoesNotExist:
        return  # AgriPrice department not created yet (run 0017 first)

    config, created = ActivityTypeConfig.objects.get_or_create(
        value="stockists_visit",
        defaults={
            "label": "Stockists visit",
            "order": 100,
            "form_fields": STOCKISTS_VISIT_FORM_FIELDS,
        },
    )
    if created:
        config.departments.add(agriprice)
    else:
        config.label = "Stockists visit"
        config.form_fields = STOCKISTS_VISIT_FORM_FIELDS
        config.save(update_fields=["label", "form_fields"])
        if agriprice not in config.departments.all():
            config.departments.add(agriprice)


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_user_current_refresh_jti"),
        ("visits", "0018_visit_stockists_visit_fields"),
    ]

    operations = [
        migrations.RunPython(seed_stockists_visit_activity, reverse_noop),
    ]
