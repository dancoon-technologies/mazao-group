from django.db import migrations


def create_site_config(apps, schema_editor):
    SiteConfig = apps.get_model("site_config", "SiteConfig")
    if not SiteConfig.objects.exists():
        SiteConfig.objects.create(
            visit_max_distance_meters=100,
            visit_warning_distance_meters=80,
            visit_travel_validation_window_hours=12.0,
            visit_max_travel_speed_kmh=120.0,
            visit_photo_max_size_mb=5,
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("site_config", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_site_config, noop),
    ]
