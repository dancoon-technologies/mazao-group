# Add activity_types (list) so a visit can record multiple activities; activity_type remains primary for reporting.

from django.db import migrations, models


def backfill_activity_types(apps, schema_editor):
    Visit = apps.get_model("visits", "Visit")
    for v in Visit.objects.iterator():
        if not v.activity_types and v.activity_type:
            v.activity_types = [v.activity_type]
            v.save(update_fields=["activity_types"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0013_alter_visit_farmers_feedback_alter_visit_notes"),
    ]

    operations = [
        migrations.AddField(
            model_name="visit",
            name="activity_types",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="List of activity type slugs performed in this visit. activity_type is the first (primary) for reporting.",
            ),
        ),
        migrations.RunPython(backfill_activity_types, noop),
    ]
