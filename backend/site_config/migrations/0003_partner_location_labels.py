# Generated migration for configurable partner/location labels (Farmer/Farm vs Stockist/Outlet)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("site_config", "0002_seed_site_config"),
    ]

    operations = [
        migrations.AddField(
            model_name="siteconfig",
            name="partner_label",
            field=models.CharField(
                default="Farmer",
                help_text="Label for the person/entity (e.g. Farmer, Stockist, or Farmer / Stockist).",
                max_length=64,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="siteconfig",
            name="location_label",
            field=models.CharField(
                default="Farm",
                help_text="Label for the location/plot (e.g. Farm, Outlet, or Farm / Outlet).",
                max_length=64,
            ),
            preserve_default=False,
        ),
    ]
