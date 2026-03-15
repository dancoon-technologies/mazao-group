# Add Visit fields for Stockists visit (AgriPrice): number_of_stockists_visited,
# product_focus, merchandising, counter_training.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0017_seed_agriprice_products"),
    ]

    operations = [
        migrations.AddField(
            model_name="visit",
            name="number_of_stockists_visited",
            field=models.PositiveIntegerField(
                blank=True,
                help_text="Number of stockists visited (e.g. for stockists_visit activity).",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="visit",
            name="product_focus",
            field=models.ForeignKey(
                blank=True,
                help_text="Primary product focus for this visit (e.g. stockists_visit).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="visits_as_focus",
                to="visits.product",
            ),
        ),
        migrations.AddField(
            model_name="visit",
            name="merchandising",
            field=models.CharField(
                blank=True,
                help_text="Merchandising notes (e.g. shelf placement, display).",
                max_length=500,
            ),
        ),
        migrations.AddField(
            model_name="visit",
            name="counter_training",
            field=models.CharField(
                blank=True,
                help_text="Counter training notes.",
                max_length=500,
            ),
        ),
    ]
