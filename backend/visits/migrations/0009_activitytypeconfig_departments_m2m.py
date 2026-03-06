# Replace ActivityTypeConfig.departments JSONField with M2M to accounts.Department

from django.db import migrations, models


def migrate_departments_to_m2m(apps, schema_editor):
    ActivityTypeConfig = apps.get_model("visits", "ActivityTypeConfig")
    Department = apps.get_model("accounts", "Department")
    for config in ActivityTypeConfig.objects.all():
        # Old field: departments was JSON list of slugs
        slugs = getattr(config, "departments", None) or []
        if not isinstance(slugs, list):
            continue
        for slug in slugs:
            try:
                dept = Department.objects.get(slug=slug)
                config.department_list.add(dept)
            except Department.DoesNotExist:
                pass


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_department"),
        ("visits", "0008_visit_photo_metadata"),
    ]

    operations = [
        migrations.AddField(
            model_name="activitytypeconfig",
            name="department_list",
            field=models.ManyToManyField(
                blank=True,
                help_text="Leave empty = visible to all departments; otherwise only these.",
                related_name="activity_type_configs",
                to="accounts.department",
            ),
        ),
        migrations.RunPython(migrate_departments_to_m2m, noop_reverse),
        migrations.RemoveField(
            model_name="activitytypeconfig",
            name="departments",
        ),
        migrations.RenameField(
            model_name="activitytypeconfig",
            old_name="department_list",
            new_name="departments",
        ),
    ]
