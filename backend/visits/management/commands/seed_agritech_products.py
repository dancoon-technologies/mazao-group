"""
Seed products for the Agritech (seedlings) department.

Run from project root:
  python manage.py seed_agritech_products

Creates the Agritech department if missing, then creates or skips each product
(name, code, unit). Safe to run multiple times (get_or_create).
"""

import re

from django.core.management.base import BaseCommand

from accounts.models import Department
from visits.models import Product


# Agitech seedlings product names (order preserved)
AGRITECH_PRODUCTS = [
    "Tomatoes",
    "Cabbage",
    "Capsicum",
    "Collards",
    "Spinach",
    "Melon",
    "Onion",
    "Chilli",
    "Tarere",
    "Managu",
    "Broccoli",
    "Cauliflower",
    "Butternut",
    "Squash",
    "Potatoes",
    "Cucumber",
    "Leek",
    "Courgette",
    "Okra",
    "Papaya",
    "Fodder crop",
    "Fruit trees",
    "Herbs",
]

DEFAULT_UNIT = "trays"


def slug_from_name(name: str) -> str:
    """Lowercase, replace spaces with underscores, strip non-alphanumeric."""
    s = name.strip().lower().replace(" ", "_")
    return re.sub(r"[^a-z0-9_]", "", s)


class Command(BaseCommand):
    help = "Seed Agritech department and seedling products (tomatoes, cabbage, etc.)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--unit",
            type=str,
            default=DEFAULT_UNIT,
            help=f"Default unit for products (default: {DEFAULT_UNIT})",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only print what would be created, do not write to DB.",
        )

    def handle(self, *args, **options):
        unit = (options.get("unit") or DEFAULT_UNIT).strip() or ""
        dry_run = options.get("dry_run", False)

        if dry_run:
            self.stdout.write("DRY RUN — no changes will be saved.")

        # Get or create Agritech department (slug from existing migration: agritech)
        try:
            department = Department.objects.get(slug="agritech")
            self.stdout.write(f"Using existing department: {department.name} (slug=agritech)")
        except Department.DoesNotExist:
            if dry_run:
                self.stdout.write("Would create department: Agritech (slug=agritech)")
                department = None
            else:
                department = Department.objects.create(name="Agritech", slug="agritech")
                self.stdout.write(self.style.SUCCESS(f"Created department: {department.name}"))

        if department is None and dry_run:
            created = len(AGRITECH_PRODUCTS)
            self.stdout.write(f"Would create {created} products with unit={unit or '(blank)'}")
            for name in AGRITECH_PRODUCTS:
                self.stdout.write(f"  - {name} (code={slug_from_name(name)})")
            return

        created_count = 0
        for name in AGRITECH_PRODUCTS:
            name_clean = name.strip()
            if not name_clean:
                continue
            code = slug_from_name(name_clean)
            if dry_run:
                exists = Product.objects.filter(department=department, name=name_clean).exists()
                self.stdout.write(f"  {'(exists)' if exists else 'Would create'}: {name_clean} (code={code}, unit={unit})")
                if not exists:
                    created_count += 1
                continue
            _, created = Product.objects.get_or_create(
                department=department,
                name=name_clean,
                defaults={"code": code, "unit": unit},
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"  Created: {name_clean}"))

        if not dry_run:
            self.stdout.write(self.style.SUCCESS(f"Done. Created {created_count} new product(s)."))
        else:
            self.stdout.write(f"Would create {created_count} new product(s).")
