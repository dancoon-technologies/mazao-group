# Data migration: seed ActivityTypeConfig from legacy Visit.ActivityType choices (all departments)

from django.db import migrations


LEGACY_CHOICES = [
    ("order_collection", "Order collection"),
    ("debt_collections", "Debt collections"),
    ("account_opening", "Account opening"),
    ("farm_to_farm_visits", "Farm to farm visits"),
    ("key_farm_visits", "Key farm visits"),
    ("group_training", "Group training"),
    ("common_interest_group_training", "Common Interest Group training"),
    ("stakeholder_group_training", "Stakeholder group training"),
    ("exhibition", "Exhibition"),
    ("market_day_activation", "Market day activation"),
    ("market_survey", "Market survey"),
    ("competition_intelligence", "Competition intelligence gathering"),
    ("reporting", "Reporting"),
    ("demo_set_up", "Demo set up"),
    ("spot_demo", "Spot demo"),
    ("demo_site_training", "Demo site training"),
    ("stakeholder_engagement", "Stakeholder engagement"),
    ("farmers_cooperative_engagement", "Farmers Cooperative society engagement"),
    ("stockists_activation", "Stockists activation"),
    ("merchandising", "Merchandising"),
    ("route_storming", "Route storming"),
    ("farming_pocket_storming", "Farming pocket storming"),
    ("counter_staff_training", "Counter staff training"),
    ("counter_staff_bonding", "Counter staff bonding session"),
    ("key_farmers_bonding", "Key Farmers bonding session / Goat eating sessions"),
]


def seed_activity_types(apps, schema_editor):
    ActivityTypeConfig = apps.get_model("visits", "ActivityTypeConfig")
    for order, (value, label) in enumerate(LEGACY_CHOICES):
        ActivityTypeConfig.objects.get_or_create(
            value=value,
            defaults={"label": label, "order": order, "departments": []},
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('visits', '0006_activitytypeconfig_alter_visit_activity_type'),
    ]

    operations = [
        migrations.RunPython(seed_activity_types, noop),
    ]
