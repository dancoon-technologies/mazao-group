# Remove product_focus FK; product_focus_ids is the source of truth.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0021_visit_product_focus_ids"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="visit",
            name="product_focus",
        ),
    ]
