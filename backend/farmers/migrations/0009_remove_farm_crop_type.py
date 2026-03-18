# Remove crop_type from Farm; no longer collected in add-farmer/add-farm/outlet forms.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("farmers", "0008_remove_farmer_assigned_officer"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="farm",
            name="crop_type",
        ),
    ]
