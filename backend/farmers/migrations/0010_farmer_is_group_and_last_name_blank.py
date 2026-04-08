from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("farmers", "0009_remove_farm_crop_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="farmer",
            name="is_group",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="farmer",
            name="last_name",
            field=models.CharField(blank=True, max_length=100),
        ),
    ]

