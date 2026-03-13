# No-op: 0003 already added partner_label/location_label with correct help_text.
# Kept so migration history stays consistent for DBs that have this applied.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("site_config", "0004_departmentterminology"),
    ]

    operations = []
