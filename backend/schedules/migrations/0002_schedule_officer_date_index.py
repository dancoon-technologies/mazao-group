# Index for schedule list by officer/date

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("schedules", "0001_initial"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="schedule",
            index=models.Index(fields=["officer", "-scheduled_date"], name="sched_officer_date"),
        ),
    ]
