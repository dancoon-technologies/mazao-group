# Add product_focus_ids for multi-product focus per visit.

from django.db import migrations, models


def backfill_product_focus_ids(apps, schema_editor):
    Visit = apps.get_model("visits", "Visit")
    for visit in Visit.objects.filter(product_focus_id__isnull=False):
        visit.product_focus_ids = [str(visit.product_focus_id)]
        visit.save(update_fields=["product_focus_ids"])


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0020_activitytypeconfig_is_active_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="visit",
            name="product_focus_ids",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="All product focus IDs for this visit (multi-select). product_focus is the first.",
            ),
        ),
        migrations.RunPython(backfill_product_focus_ids, migrations.RunPython.noop),
    ]
