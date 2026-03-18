# Remove product_focus_ids; use product_lines only for products/sales.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("visits", "0022_remove_visit_product_focus"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="visit",
            name="product_focus_ids",
        ),
    ]
