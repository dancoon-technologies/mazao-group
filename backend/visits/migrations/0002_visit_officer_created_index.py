# Index for visit list and dashboard by officer/date

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0001_initial"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="visit",
            index=models.Index(fields=["officer", "-created_at"], name="visit_officer_created"),
        ),
    ]
