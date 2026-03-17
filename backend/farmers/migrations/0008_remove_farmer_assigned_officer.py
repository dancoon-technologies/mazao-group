# Remove assigned_officer from Farmer; any officer can record visits for any farmer.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("farmers", "0007_remove_farmer_crop_type"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="farmer",
            name="assigned_officer",
        ),
    ]
