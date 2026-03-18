"""
Seed ActivityTypeConfig.form_fields per activity type from the field-activity mapping.

Visit model only has 7 optional fields for step 3: crop_stage, germination_percent,
survival_rate, pests_diseases, order_value, harvest_kgs, farmers_feedback.
This script sets form_fields (key, label, required) so each activity shows the most
relevant of these with activity-appropriate labels. Run:

  python manage.py seed_activity_form_fields

See backend/docs/FIELD_ACTIVITY_FORM_FIELDS.md for full mapping and fields not yet in schema.
"""

from django.core.management.base import BaseCommand

# Activity value -> list of {key, label, required}. Keys must be Visit step-3 keys only.
ACTIVITY_FORM_FIELDS = {
    "order_collection": [
        {"key": "order_value", "label": "Total order value", "required": False},
        {"key": "farmers_feedback", "label": "Notes (payment, delivery date, competitor products)", "required": False},
    ],
    "debt_collections": [
        {"key": "order_value", "label": "Amount collected", "required": False},
        {"key": "farmers_feedback", "label": "Reason for non-payment (if partial) / Balance / Invoices settled", "required": False},
    ],
    "account_opening": [
        {"key": "farmers_feedback", "label": "Payment preference, referral source, input history", "required": False},
    ],
    "farm_to_farm_visits": [
        {"key": "crop_stage", "label": "Crop stage / Production stage", "required": False},
        {"key": "pests_diseases", "label": "Pest / disease observed", "required": False},
        {"key": "farmers_feedback", "label": "Advisory given / Products recommended / Follow-up date", "required": False},
    ],
    "key_farm_visits": [
        {"key": "crop_stage", "label": "Crop type / Technology demonstrated", "required": False},
        {"key": "harvest_kgs", "label": "Yield performance (kg)", "required": False},
        {"key": "farmers_feedback", "label": "Current challenges / Farmer feedback / Neighboring farmers influenced", "required": False},
    ],
    "group_training": [
        {"key": "farmers_feedback", "label": "Key questions asked / Participant feedback / Attendance notes", "required": False},
    ],
    "common_interest_group_training": [
        {"key": "order_value", "label": "Potential bulk orders value", "required": False},
        {"key": "farmers_feedback", "label": "Topic covered / Input adoption interest", "required": False},
    ],
    "stakeholder_group_training": [
        {"key": "farmers_feedback", "label": "Collaboration opportunities / Support requested / Future plans", "required": False},
    ],
    "exhibition": [
        {"key": "order_value", "label": "Sales at event", "required": False},
        {"key": "farmers_feedback", "label": "Leads / Product interest / Materials distributed / Competitors present", "required": False},
    ],
    "market_day_activation": [
        {"key": "order_value", "label": "Orders taken", "required": False},
        {"key": "farmers_feedback", "label": "Products promoted / Demonstrations / Competitor presence / Farmer feedback", "required": False},
    ],
    "market_survey": [
        {"key": "farmers_feedback", "label": "Product prices, availability, demand trends, preferences, market gaps", "required": False},
    ],
    "competition_intelligence": [
        {"key": "farmers_feedback", "label": "Competitor product, price, promotions, farmer perception, distribution", "required": False},
    ],
    "reporting": [
        {"key": "order_value", "label": "Revenue generated", "required": False},
        {"key": "farmers_feedback", "label": "Farmers reached / Issues encountered / Recommendations", "required": False},
    ],
    "demo_set_up": [
        {"key": "crop_stage", "label": "Crop / technology demonstrated", "required": False},
        {"key": "farmers_feedback", "label": "Plot size, inputs used, expected evaluation date", "required": False},
    ],
    "spot_demo": [
        {"key": "order_value", "label": "Orders generated", "required": False},
        {"key": "farmers_feedback", "label": "Product demonstrated / Key message / Farmer reactions", "required": False},
    ],
    "demo_site_training": [
        {"key": "crop_stage", "label": "Crop stage", "required": False},
        {"key": "farmers_feedback", "label": "Training topic / Farmer feedback / Adoption interest", "required": False},
    ],
    "stakeholder_engagement": [
        {"key": "farmers_feedback", "label": "Purpose / Issues discussed / Agreements / Follow-up actions", "required": False},
    ],
    "farmers_cooperative_engagement": [
        {"key": "order_value", "label": "Bulk purchase potential / Credit needs", "required": False},
        {"key": "farmers_feedback", "label": "Key crops, current suppliers, meeting outcomes", "required": False},
    ],
    "stockists_activation": [
        {"key": "order_value", "label": "Current stock value / Sales performance / Reorder needs", "required": False},
        {"key": "farmers_feedback", "label": "Promotional materials provided", "required": False},
    ],
    "merchandising": [
        {"key": "farmers_feedback", "label": "Shelf placement / Display materials / Competitor displays / Stock levels", "required": False},
    ],
    "route_storming": [
        {"key": "order_value", "label": "Orders collected", "required": False},
        {"key": "farmers_feedback", "label": "Route / Villages / Shops / Market observations", "required": False},
    ],
    "farming_pocket_storming": [
        {"key": "farmers_feedback", "label": "Main crops / Farmers engaged / Input demand / Demo opportunities", "required": False},
    ],
    "counter_staff_training": [
        {"key": "farmers_feedback", "label": "Training topic / Product knowledge before-after / Questions / Materials provided", "required": False},
    ],
    "counter_staff_bonding": [
        {"key": "farmers_feedback", "label": "Relationship strength / Issues raised / Support requested", "required": False},
    ],
    "key_farmers_bonding": [
        {"key": "order_value", "label": "Orders generated", "required": False},
        {"key": "farmers_feedback", "label": "Discussion topics / Product feedback / New opportunities", "required": False},
    ],
    "stockists_visit": [
        {"key": "number_of_stockists_visited", "label": "Number of Stockists visited", "required": False},
        {"key": "product_lines", "label": "Products", "required": False},
        {"key": "order_value", "label": "Total Sales done", "required": False},
        {"key": "merchandising", "label": "Merchandising", "required": False},
        {"key": "counter_training", "label": "Counter training", "required": False},
    ],
}


class Command(BaseCommand):
    help = "Seed ActivityTypeConfig.form_fields for each activity type from the field-activity mapping."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be updated without writing to the database.",
        )

    def handle(self, *args, **options):
        from visits.models import ActivityTypeConfig

        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write("Dry run — no changes will be saved.")

        updated = 0
        missing = []
        for value, form_fields in ACTIVITY_FORM_FIELDS.items():
            try:
                config = ActivityTypeConfig.objects.get(value=value)
            except ActivityTypeConfig.DoesNotExist:
                missing.append(value)
                continue
            if config.form_fields != form_fields:
                self.stdout.write(f"  {value}: set form_fields ({len(form_fields)} fields)")
                if not dry_run:
                    config.form_fields = form_fields
                    config.save(update_fields=["form_fields"])
                updated += 1

        if missing:
            self.stdout.write(self.style.WARNING(f"Activity types not in DB (skipped): {missing}"))
        self.stdout.write(self.style.SUCCESS(f"Updated {updated} activity type(s)."))
        if dry_run and updated:
            self.stdout.write("Run without --dry-run to apply changes.")
