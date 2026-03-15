# Product (per department) and VisitProduct (sales / given during visit).

import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_user_current_refresh_jti"),
        ("visits", "0015_visitphoto"),
    ]

    operations = [
        migrations.CreateModel(
            name="Product",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=120)),
                ("code", models.CharField(blank=True, help_text="Optional SKU or product code.", max_length=60)),
                ("unit", models.CharField(blank=True, help_text="e.g. kg, litres, sachets.", max_length=30)),
                (
                    "department",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="products",
                        to="accounts.department",
                    ),
                ),
            ],
            options={
                "ordering": ["department", "name"],
                "unique_together": {("department", "name")},
            },
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["department"], name="product_department_id"),
        ),
        migrations.CreateModel(
            name="VisitProduct",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "quantity_sold",
                    models.DecimalField(
                        decimal_places=3,
                        default=0,
                        help_text="Quantity sold during this visit.",
                        max_digits=12,
                    ),
                ),
                (
                    "quantity_given",
                    models.DecimalField(
                        decimal_places=3,
                        default=0,
                        help_text="Quantity given (e.g. samples) during this visit.",
                        max_digits=12,
                    ),
                ),
                (
                    "product",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="visit_products",
                        to="visits.product",
                    ),
                ),
                (
                    "visit",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="product_lines",
                        to="visits.visit",
                    ),
                ),
            ],
            options={
                "ordering": ["visit", "product"],
            },
        ),
        migrations.AddConstraint(
            model_name="visitproduct",
            constraint=models.UniqueConstraint(
                fields=("visit", "product"),
                name="visitproduct_visit_product_unique",
            ),
        ),
        migrations.AddIndex(
            model_name="visitproduct",
            index=models.Index(fields=["visit"], name="visitproduct_visit_id"),
        ),
    ]
