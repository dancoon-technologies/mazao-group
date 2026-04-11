# Field activity → form fields mapping

This doc maps the **proposed field data per activity** (see field-activity list) to what the app can collect today.

## Current schema (Visit step 3)

The visit record has **7 optional fields** used in the “Additional” step when recording a visit:

| Key | Type | Use |
|-----|------|-----|
| `crop_stage` | text | Crop stage, technology, crop type |
| `germination_percent` | number | Germination % |
| `survival_rate` | text | Survival rate |
| `pests_diseases` | text | Pests / diseases observed |
| `order_value` | decimal | Money: order value, amount collected, revenue, sales, bulk potential |
| `harvest_kgs` | decimal | Yield (kg) |
| `farmers_feedback` | text | Free-form: feedback, notes, recommendations, outcomes |

**Cross-cutting data** already captured for all visits: officer (from auth), date/time (`created_at`), GPS (`latitude`, `longitude`), photo, and notes (step 2). No extra “additional fields” are needed for those.

## How we use the 7 keys per activity

The seed script `seed_activity_form_fields` sets `ActivityTypeConfig.form_fields` so that for each activity type the app shows only the most relevant of the 7 keys, with **activity-specific labels** (e.g. “Total order value” for Order collection, “Amount collected” for Debt collections). That keeps step 3 focused and avoids showing every field for every activity.

**`product_lines`** (products sold per line item) is appended to every activity’s `form_fields` by migration `0030_add_product_lines_to_all_activity_configs` and by the seed helper `_with_product_lines`, so officers can record product quantities where the department has products configured.

- **order_value** is reused for any monetary value: total order, amount collected, revenue, sales at event, bulk potential, credit needs, etc.
- **farmers_feedback** is reused for any free text: reasons, feedback, recommendations, topics, outcomes, competitor notes, etc.
- **crop_stage** is used for crop/technology stage or type where relevant.
- **harvest_kgs** is used for yield (e.g. Key farm visits).
- **pests_diseases** is used where pest/disease is relevant (e.g. Farm to farm visits).

So many of the “proposed fields” are **combined into one of these 7** via the label (e.g. “Reason for non-payment (if partial) / Balance / Invoices settled” in one `farmers_feedback` field).

## Proposed fields we **cannot** store as separate columns today

These would need either new columns or a single **JSON “extra_data”** field on `Visit` (and UI/API changes) to capture as structured data:

- Customer/Farmer name, Customer ID, Account number → already identified by visit’s **farmer** (and farm); no extra field.
- Location (Village, Ward, County) → from **farm** or farmer if we add those fields to Farm/Farmer.
- Product name/SKU, Quantity ordered, Unit price → would need structured fields or JSON.
- Payment method (Cash/Credit/Mobile Money) → currently in notes or `farmers_feedback`.
- Delivery date required, Stock availability, Competitor products currently used → notes / `farmers_feedback`.
- Number of participants (Male/Female/Youth), Training materials, Attendance register → would need JSON or new fields.
- All “Number of…” (e.g. visitors, leads, farmers reached) → could go in notes/feedback or a future numeric/JSON field.

**Recommendation:** Run the seed script to get activity-appropriate step-3 fields with current schema. For richer, queryable data (e.g. product, quantity, payment method, participant counts), add a `Visit.extra_data` JSONField and extend the mobile form and API to read/write it per activity.

## Seed command

From project root (backend):

```bash
python manage.py seed_activity_form_fields
```

Use `--dry-run` to see what would be updated without saving.
