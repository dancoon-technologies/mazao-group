# VisitPhoto for multiple photos per visit (Visit.photo remains primary).

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0014_visit_activity_types"),
    ]

    operations = [
        migrations.CreateModel(
            name="VisitPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="visits/%Y/%m/")),
                ("order", models.PositiveSmallIntegerField(default=0, help_text="Display order (0 = first after primary).")),
                (
                    "visit",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="photos",
                        to="visits.visit",
                    ),
                ),
            ],
            options={
                "ordering": ["visit", "order"],
            },
        ),
        migrations.AddIndex(
            model_name="visitphoto",
            index=models.Index(fields=["visit"], name="visitphoto_visit_id"),
        ),
    ]
