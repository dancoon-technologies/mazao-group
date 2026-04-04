# Generated manually — RouteStop removed; routes are day plans with visits linked by route_id.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("routes", "0003_alter_routereport_report_data_and_more"),
    ]

    operations = [
        migrations.DeleteModel(
            name="RouteStop",
        ),
    ]
