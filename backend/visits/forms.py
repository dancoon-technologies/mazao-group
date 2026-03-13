"""
Form helpers for visits admin. FormFieldsWidget provides a row-based UI
for ActivityTypeConfig.form_fields (JSON list of {key, label, required}).
"""

import json

from django import forms
from django.utils.html import format_html
from django.utils.safestring import mark_safe


# Default labels for known keys (used to prefill when key is selected)
KEY_TO_LABEL = {
    "crop_stage": "Crop Stage",
    "germination_percent": "Germination %",
    "survival_rate": "Survival Rate %",
    "pests_diseases": "Pests / Diseases",
    "order_value": "Order Value",
    "harvest_kgs": "Harvest (kgs)",
    "farmers_feedback": "Farmers Feedback",
}


class FormFieldsWidget(forms.Widget):
    """Widget that renders form_fields as editable rows (key, label, required) and serializes to JSON list."""

    def __init__(self, attrs=None):
        super().__init__(attrs)
        self.known_keys = list(KEY_TO_LABEL.keys())

    def _parse_value(self, value):
        if value is None:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                return json.loads(value) if value.strip() else []
            except json.JSONDecodeError:
                return []
        return []

    def value_from_datadict(self, data, files, name):
        out = []
        i = 0
        while True:
            key = data.get(f"{name}_{i}_key", "").strip()
            if not key:
                i += 1
                if i > 500:
                    break
                continue
            label = (data.get(f"{name}_{i}_label") or "").strip()
            required = data.get(f"{name}_{i}_required") == "on"
            out.append({"key": key, "label": label or key, "required": required})
            i += 1
            if i > 500:
                break
        return out

    def format_value(self, value):
        return self._parse_value(value)

    def render(self, name, value, attrs=None, renderer=None):
        rows = self._parse_value(value)
        next_index = len(rows) + 1
        id_attr = attrs.get("id", f"id_{name}") if attrs else f"id_{name}"
        container_id = f"{id_attr}_container"
        tbody_id = f"{id_attr}_tbody"
        datalist_id = f"{id_attr}_keys_datalist"
        key_labels_json = json.dumps(KEY_TO_LABEL).replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")

        out = [
            '<datalist id="{}">'.format(datalist_id),
        ]
        for k in self.known_keys:
            out.append('<option value="{}">'.format(k))
        out.append("</datalist>")
        out.append(
            '<div class="form-fields-widget" id="{}" data-name="{}" data-next-index="{}" data-key-labels="{}">'.format(
                container_id, name, next_index, key_labels_json
            )
        )
        out.extend([
            '<table class="form-fields-table">',
            "<thead><tr><th>Key</th><th>Label</th><th>Required</th><th></th></tr></thead>",
            '<tbody id="{}">'.format(tbody_id),
        ])

        for i, row in enumerate(rows):
            key = row.get("key", "") if isinstance(row, dict) else ""
            label = row.get("label", "") if isinstance(row, dict) else ""
            required = row.get("required", False) if isinstance(row, dict) else False
            out.append(self._render_row(name, i, key, label, required, datalist_id))

        out.append(self._render_row(name, len(rows), "", "", False, datalist_id))
        out.append("</tbody></table>")
        out.append(
            '<p><button type="button" class="button add-form-field-row">Add another field</button></p>'
        )
        out.append("</div>")

        script = """
        <script>
        (function() {
            var container = document.getElementById('%s');
            if (!container) return;
            var name = container.getAttribute('data-name');
            var tbody = document.getElementById('%s');
            var datalistId = '%s';
            var keyLabels = {};
            try {
                var raw = container.getAttribute('data-key-labels');
                if (raw) keyLabels = JSON.parse(raw.replace(/&quot;/g, '"'));
            } catch (e) {}
            function prefillLabel(keyInput) {
                var key = keyInput.value.trim();
                var labelInput = keyInput.closest('tr').querySelector('input[name$="_label"]');
                if (key && keyLabels[key] && !labelInput.value.trim()) {
                    labelInput.value = keyLabels[key];
                }
            }
            function attachKeyHandlers(row) {
                var keyInput = row.querySelector('input[name$="_key"]');
                if (keyInput) {
                    keyInput.setAttribute('list', datalistId);
                    keyInput.addEventListener('blur', function() { prefillLabel(this); });
                    keyInput.addEventListener('change', function() { prefillLabel(this); });
                }
            }
            function addRow() {
                var next = parseInt(container.getAttribute('data-next-index'), 10);
                var tr = document.createElement('tr');
                tr.innerHTML = '<td><input type="text" name="' + name + '_' + next + '_key" list="' + datalistId + '" placeholder="e.g. crop_stage" maxlength="80"></td>' +
                    '<td><input type="text" name="' + name + '_' + next + '_label" placeholder="Display label" maxlength="150"></td>' +
                    '<td><input type="checkbox" name="' + name + '_' + next + '_required"></td>' +
                    '<td><button type="button" class="button remove-form-field-row">Remove</button></td>';
                tbody.appendChild(tr);
                attachKeyHandlers(tr);
                tr.querySelector('.remove-form-field-row').addEventListener('click', function() {
                    tr.remove();
                });
                container.setAttribute('data-next-index', String(next + 1));
            }
            container.querySelector('.add-form-field-row').addEventListener('click', addRow);
            [].forEach.call(container.querySelectorAll('.remove-form-field-row'), function(btn) {
                btn.addEventListener('click', function() { btn.closest('tr').remove(); });
            });
            [].forEach.call(tbody.querySelectorAll('tr'), function(tr) {
                attachKeyHandlers(tr);
            });
        })();
        </script>
        """ % (
            container_id,
            tbody_id,
            datalist_id,
        )
        out.append(script)
        return mark_safe("\n".join(out))

    def _render_row(self, name, index, key, label, required, datalist_id=""):
        list_attr = format_html(' list="{}"', datalist_id) if datalist_id else ""
        return format_html(
            "<tr>"
            '<td><input type="text" name="{}_{}_key" value="{}" placeholder="e.g. crop_stage" maxlength="80"{}></td>'
            '<td><input type="text" name="{}_{}_label" value="{}" placeholder="Display label" maxlength="150"></td>'
            '<td><input type="checkbox" name="{}_{}_required" {}></td>'
            '<td><button type="button" class="button remove-form-field-row">Remove</button></td>'
            "</tr>",
            name,
            index,
            key,
            list_attr,
            name,
            index,
            label,
            name,
            index,
            "checked" if required else "",
        )


class FormFieldsFormField(forms.Field):
    """Form field that uses FormFieldsWidget and normalizes to a list of dicts."""

    widget = FormFieldsWidget

    def to_python(self, value):
        if value is None:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                return json.loads(value) if value.strip() else []
            except json.JSONDecodeError:
                raise forms.ValidationError("Invalid JSON for form fields.")
        return []

    def validate(self, value):
        super().validate(value)
        if not value:
            return
        for i, item in enumerate(value):
            if not isinstance(item, dict):
                raise forms.ValidationError(
                    "Item %s must be an object with key, label, and optional required."
                    % (i + 1,)
                )
            if not item.get("key"):
                raise forms.ValidationError("Item %s: key is required." % (i + 1,))
