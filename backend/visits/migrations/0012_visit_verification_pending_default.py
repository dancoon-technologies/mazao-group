# Visit verification_status: add "pending" and set as default for new visits.
# Existing rows keep their current value (verified/rejected).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0011_activitytypeconfig_form_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="visit",
            name="verification_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("verified", "Verified"),
                    ("rejected", "Rejected"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
    ]
