from django import forms
from django.contrib import admin

from .forms import FormFieldsFormField
from .models import ActivityTypeConfig, Product, Visit, VisitPhoto, VisitProduct


class ActivityTypeConfigAdminForm(forms.ModelForm):
    form_fields = FormFieldsFormField(
        required=False,
        help_text="Optional list of {key, label, required} for visit form step 3. Keys: crop_stage, germination_percent, survival_rate, pests_diseases, order_value, harvest_kgs, farmers_feedback, number_of_stockists_visited, product_focus, merchandising, counter_training. Empty = show all.",
    )

    class Meta:
        model = ActivityTypeConfig
        fields = "__all__"


@admin.register(ActivityTypeConfig)
class ActivityTypeConfigAdmin(admin.ModelAdmin):
    form = ActivityTypeConfigAdminForm
    list_display = ("value", "label", "order", "departments_display")
    list_editable = ("order",)
    list_filter = ("departments",)
    search_fields = ("value", "label")
    filter_horizontal = ("departments",)
    fieldsets = (
        (None, {"fields": ("value", "label", "order")}),
        ("Departments", {"fields": ("departments",)}),
        (
            "Step 3 form fields",
            {
                "fields": ("form_fields",),
                "description": "Optional. List of {key, label, required} for record-visit step 3. Keys: crop_stage, germination_percent, survival_rate, pests_diseases, order_value, harvest_kgs, farmers_feedback, number_of_stockists_visited, product_focus, merchandising, counter_training. Empty = show all.",
            },
        ),
    )

    def departments_display(self, obj):
        if not obj.departments.exists():
            return "All departments"
        return ", ".join(d.name for d in obj.departments.all())

    departments_display.short_description = "Departments"


class VisitPhotoInline(admin.TabularInline):
    model = VisitPhoto
    extra = 0
    readonly_fields = ("image",)


class VisitProductInline(admin.TabularInline):
    model = VisitProduct
    extra = 0
    raw_id_fields = ("product",)


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = (
        "officer",
        "farmer",
        "activity_type",
        "verification_status",
        "distance_from_farmer",
        "created_at",
    )
    list_filter = ("verification_status", "activity_type", "created_at")
    raw_id_fields = ("officer", "farmer", "product_focus")
    readonly_fields = ("created_at",)
    inlines = (VisitPhotoInline, VisitProductInline)
    fieldsets = (
        (None, {"fields": ("officer", "farmer", "farm", "schedule", "activity_type", "activity_types", "verification_status")}),
        ("Location", {"fields": ("latitude", "longitude", "distance_from_farmer", "photo", "photo_taken_at", "photo_device_info", "photo_place_name", "notes")}),
        ("Step 3 / Additional", {"fields": ("crop_stage", "germination_percent", "survival_rate", "pests_diseases", "order_value", "harvest_kgs", "farmers_feedback")}),
        ("Stockists visit (AgriPrice)", {"fields": ("number_of_stockists_visited", "product_focus", "merchandising", "counter_training"), "classes": ("collapse",)}),
    )


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "unit", "department")
    list_filter = ("department",)
    search_fields = ("name", "code")
