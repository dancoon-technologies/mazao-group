from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("farmers", "0010_farmer_is_group_and_last_name_blank"),
    ]

    operations = [
        migrations.AddField(
            model_name="farmer",
            name="is_sacco",
            field=models.BooleanField(default=False),
        ),
    ]

