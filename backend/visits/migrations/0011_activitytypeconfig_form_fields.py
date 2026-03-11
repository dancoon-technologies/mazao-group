# Generated migration: activity-based form fields for record visit step 3

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0010_reduce_charfield_lengths"),
    ]

    operations = [
        migrations.AddField(
            model_name="activitytypeconfig",
            name="form_fields",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Optional list of {key, label, required} for visit form step 3. Keys: crop_stage, germination_percent, survival_rate, pests_diseases, order_value, harvest_kgs, farmers_feedback. Empty = show all.",
            ),
        ),
    ]
