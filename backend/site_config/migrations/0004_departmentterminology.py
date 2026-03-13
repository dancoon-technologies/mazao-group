# Generated migration: per-department terminology (partner/location labels)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_department"),
        ("site_config", "0003_partner_location_labels"),
    ]

    operations = [
        migrations.CreateModel(
            name="DepartmentTerminology",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "partner_label",
                    models.CharField(
                        default="Farmer",
                        help_text="Label for the person/entity (e.g. Farmer, Stockist).",
                        max_length=64,
                    ),
                ),
                (
                    "location_label",
                    models.CharField(
                        default="Farm",
                        help_text="Label for the location/plot (e.g. Farm, Outlet).",
                        max_length=64,
                    ),
                ),
                (
                    "department",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="terminology",
                        to="accounts.department",
                        unique=True,
                    ),
                ),
            ],
            options={
                "verbose_name": "Department terminology",
                "verbose_name_plural": "Department terminology",
            },
        ),
    ]
