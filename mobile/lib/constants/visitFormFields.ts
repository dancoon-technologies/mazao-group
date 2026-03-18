/**
 * Step-3 (additional details) helpers for record-visit.
 * All field config comes from backend options: visit_form_field_schema and default_visit_form_fields.
 * No hardcoded keys or input types — backend is the single source of truth.
 */

import type { VisitFormFieldSchemaItem } from '@/lib/api';

export type Step3InputType = 'text' | 'number' | 'integer' | 'multiline' | 'product';

export type Step3Values = Record<string, string>;

/** Get input type for a field key from schema; default 'text' if unknown. */
export function getStep3InputType(
  key: string,
  schema: Record<string, VisitFormFieldSchemaItem> | null | undefined
): Step3InputType {
  const item = schema?.[key];
  const t = item?.input_type;
  if (t === 'text' || t === 'number' || t === 'integer' || t === 'multiline' || t === 'product') return t;
  return 'text';
}

/**
 * Build API/enqueue payload for step-3 fields from step3Values using backend schema.
 * Uses schema for value_type (string/number/integer) and api_key (e.g. product_focus_id).
 * For product_focus_id: value may be comma-separated IDs; we send product_focus_ids (array) and product_focus_id (first).
 */
export function buildStep3Payload(
  step3Values: Step3Values,
  schema: Record<string, VisitFormFieldSchemaItem> | null | undefined
): Record<string, string | number | string[] | null | undefined> {
  const out: Record<string, string | number | string[] | null | undefined> = {};
  for (const [key, value] of Object.entries(step3Values)) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    const item = schema?.[key];
    const apiKey = item?.api_key ?? key;
    const valueType = item?.value_type ?? 'string';
    if (apiKey === 'product_focus_id') {
      const ids = trimmed ? trimmed.split(',').map((s) => s.trim()).filter(Boolean) : [];
      if (ids.length > 1) {
        out.product_focus_ids = ids;
        out.product_focus_id = ids[0];
      } else if (ids.length === 1) {
        out.product_focus_id = ids[0];
      }
      continue;
    }
    if (valueType === 'integer') {
      if (trimmed === '') {
        out[apiKey] = undefined;
      } else {
        const n = parseInt(trimmed, 10);
        out[apiKey] = Number.isNaN(n) ? undefined : n;
      }
      continue;
    }
    if (valueType === 'number') {
      if (trimmed === '') {
        out[apiKey] = undefined;
      } else {
        const n = parseFloat(trimmed);
        out[apiKey] = Number.isNaN(n) ? undefined : n;
      }
      continue;
    }
    out[apiKey] = trimmed || undefined;
  }
  return out;
}
