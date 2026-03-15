/**
 * Visit step-3 / additional form fields.
 * Field list and labels come from backend (ActivityTypeConfig.form_fields), configurable in
 * Django admin: Visits → Activity type configs → form_fields. This module defines which
 * keys are "standard" (fixed rows in visit detail) vs "additional" (dynamic block).
 */

import type { Visit } from "./types";
import type { ActivityTypeOption } from "./types";

/** Keys that have dedicated rows in visit detail; exclude from the "additional" dynamic block. */
export const STANDARD_VISIT_FIELD_KEYS = new Set([
  "crop_stage",
  "germination_percent",
  "survival_rate",
  "pests_diseases",
  "order_value",
  "harvest_kgs",
  "farmers_feedback",
]);

/**
 * Map form_field key to Visit property used for display value.
 * e.g. product_focus -> product_focus_display (API returns UUID + display name).
 */
export function getVisitValueKey(formFieldKey: string): keyof Visit {
  return formFieldKey === "product_focus"
    ? "product_focus_display"
    : (formFieldKey as keyof Visit);
}

export interface AdditionalVisitFieldDescriptor {
  key: string;
  label: string;
}

/**
 * Build the list of additional visit field descriptors from options activity_types.
 * Dedupes by key (first label wins). Excludes STANDARD_VISIT_FIELD_KEYS.
 * Used by visit detail modal and any UI that shows activity-specific fields.
 */
export function buildAdditionalVisitFieldsFromOptions(
  activityTypes: ActivityTypeOption[] | undefined
): AdditionalVisitFieldDescriptor[] {
  if (!activityTypes?.length) return [];
  const seen = new Set<string>();
  const out: AdditionalVisitFieldDescriptor[] = [];
  for (const at of activityTypes) {
    for (const f of at.form_fields ?? []) {
      if (STANDARD_VISIT_FIELD_KEYS.has(f.key) || seen.has(f.key)) continue;
      seen.add(f.key);
      out.push({ key: f.key, label: f.label });
    }
  }
  return out;
}
