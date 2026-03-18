"""
Single source of truth for visit step-3 (additional details) fields.
Returned in GET /api/options/ as visit_form_field_schema and default_visit_form_fields.
Mobile uses these to render and submit without hardcoded field config.
"""

# All Visit model optional fields that can appear in the step-3 form.
# input_type: how to render (text, number, integer, multiline, product).
# value_type: how to send to API (string, number, integer).
# product_lines: products with quantity sold/given (submitted separately from step-3 values).
VISIT_FORM_FIELD_SCHEMA = {
    "crop_stage": {"input_type": "text", "value_type": "string"},
    "germination_percent": {"input_type": "number", "value_type": "number"},
    "survival_rate": {"input_type": "number", "value_type": "string"},
    "pests_diseases": {"input_type": "text", "value_type": "string"},
    "order_value": {"input_type": "number", "value_type": "number"},
    "harvest_kgs": {"input_type": "number", "value_type": "number"},
    "farmers_feedback": {"input_type": "multiline", "value_type": "string"},
    "number_of_stockists_visited": {"input_type": "integer", "value_type": "integer"},
    "product_lines": {"input_type": "product", "value_type": "string"},
    "merchandising": {"input_type": "multiline", "value_type": "string"},
    "counter_training": {"input_type": "multiline", "value_type": "string"},
}

# Default form_fields when an activity type has no form_fields set (show these with generic labels).
# Labels that contain {partner} are replaced in the options view with the actual partner label.
DEFAULT_VISIT_FORM_FIELDS = [
    {"key": "crop_stage", "label": "Crop Stage", "required": False},
    {"key": "germination_percent", "label": "Germination %", "required": False},
    {"key": "survival_rate", "label": "Survival Rate %", "required": False},
    {"key": "pests_diseases", "label": "Pests/Diseases", "required": False},
    {"key": "order_value", "label": "Order Value", "required": False},
    {"key": "harvest_kgs", "label": "Harvest (kg)", "required": False},
    {"key": "farmers_feedback", "label": "{partner}'s Feedback", "required": False},
]
