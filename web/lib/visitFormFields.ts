/**
 * Visit step-3 / additional form fields.
 * Field list and labels come from backend (ActivityTypeConfig.form_fields), configurable in
 * Django admin: Visits → Activity type configs → form_fields.
 */

import type { Visit } from "./types";
import type { ActivityTypeOption } from "./types";

/**
 * Map form_field key to Visit property used for display value.
 */
export function getVisitValueKey(formFieldKey: string): keyof Visit {
  return formFieldKey as keyof Visit;
}

export interface AdditionalVisitFieldDescriptor {
  key: string;
  label: string;
}

/**
 * Build the list of visit field descriptors from options activity_types (backend form_fields).
 * Dedupes by key (first label wins). Only fields that appear in some activity's form_fields are included.
 * Labels come from the backend; {partner} in label is replaced with partnerLabel.
 */
export function buildAdditionalVisitFieldsFromOptions(
  activityTypes: ActivityTypeOption[] | undefined
): AdditionalVisitFieldDescriptor[] {
  if (!activityTypes?.length) return [];
  const seen = new Set<string>();
  const out: AdditionalVisitFieldDescriptor[] = [];
  for (const at of activityTypes) {
    for (const f of at.form_fields ?? []) {
      if (seen.has(f.key)) continue;
      seen.add(f.key);
      out.push({ key: f.key, label: f.label });
    }
  }
  return out;
}

/**
 * Build the full list of visit data field descriptors from backend only.
 * Use this to iterate visit data: only show fields that have values.
 * partnerLabel: substituted for {partner} in backend labels (e.g. "Farmer's feedback").
 */
export function buildVisitDataFieldsFromOptions(
  activityTypes: ActivityTypeOption[] | undefined,
  partnerLabel: string
): AdditionalVisitFieldDescriptor[] {
  const fields = buildAdditionalVisitFieldsFromOptions(activityTypes);
  return fields.map(({ key, label }) => ({
    key,
    label: label.replace(/\{partner\}/gi, partnerLabel),
  }));
}
