from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0027_maintenanceincidentphoto"),
    ]

    operations = [
        migrations.AddField(
            model_name="maintenanceincident",
            name="released_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="maintenanceincident",
            name="status",
            field=models.CharField(
                choices=[
                    ("reported", "Reported"),
                    ("verified_breakdown", "Verified breakdown"),
                    ("at_garage", "At garage"),
                    ("released", "Released"),
                    ("rejected", "Rejected"),
                ],
                default="reported",
                max_length=30,
            ),
        ),
    ]
