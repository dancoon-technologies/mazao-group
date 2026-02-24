# Add location FKs (store IDs only; minimal storage)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
        ("locations", "0002_seed_kenya"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="region_id",
            field=models.ForeignKey(
                blank=True,
                db_column="region_id",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="locations.region",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="county_id",
            field=models.ForeignKey(
                blank=True,
                db_column="county_id",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="locations.county",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="sub_county_id",
            field=models.ForeignKey(
                blank=True,
                db_column="sub_county_id",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="locations.subcounty",
            ),
        ),
    ]
