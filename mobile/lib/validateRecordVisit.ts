/**
 * Client-side validation for record-visit before sending to backend.
 * Mirrors backend rules where possible to reduce invalid API requests.
 * Backend remains the authority; this only catches common errors early.
 */

import type { ActivityFormFieldOption } from '@/lib/api';
import type { VisitFormFieldSchemaItem } from '@/lib/api';
import type { Step3Values } from '@/lib/constants/visitFormFields';

/** Max lengths that match backend Visit model (single source: backend; keep in sync). */
const FIELD_MAX_LENGTHS: Record<string, number> = {
  notes: 2000,
  farmers_feedback: 2000,
  crop_stage: 100,
  survival_rate: 50,
  pests_diseases: 180,
  merchandising: 500,
  counter_training: 500,
};

export interface ValidateRecordVisitInput {
  scheduleIdForSubmit: string | undefined;
  /** When set, visit is recorded as part of this route (no schedule required). */
  routeIdForSubmit?: string | undefined;
  mustSelectSchedule: boolean;
  acceptedSchedulesLength: number;
  /** True when the officer has at least one weekly route scheduled for today. */
  hasWeeklyRouteToday: boolean;
  /** True when both accepted schedules and a weekly route exist for today (user must pick one). */
  bothVisitLinkOptions?: boolean;
  visitLinkMode?: 'schedule' | 'route' | null;
  selectedFarmerId: string | null;
  selectedFarmId: string | null;
  location: { coords: { latitude: number; longitude: number } } | null;
  photoUrisLength: number;
  step3Fields: ActivityFormFieldOption[];
  step3Values: Step3Values;
  visitFormFieldSchema: Record<string, VisitFormFieldSchemaItem> | null | undefined;
  activityTypes: string[];
  activityTypesList: { value: string }[];
  notes: string;
  distanceM: number | null;
  maxDistanceM: number;
  partnerLabel: string;
  /** When true, skip step 3 (additional details) required checks — e.g. when user chooses "Record and skip report". */
  skipStep3?: boolean;
}

export interface ValidateRecordVisitResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate record-visit form state before calling API or enqueueing.
 * Returns { valid: true } or { valid: false, error: "message" }.
 */
export function validateRecordVisit(input: ValidateRecordVisitInput): ValidateRecordVisitResult {
  const {
    mustSelectSchedule,
    acceptedSchedulesLength,
    hasWeeklyRouteToday,
    bothVisitLinkOptions,
    visitLinkMode,
    selectedFarmerId,
    selectedFarmId,
    location,
    photoUrisLength,
    step3Fields,
    step3Values,
    visitFormFieldSchema,
    activityTypes,
    activityTypesList,
    notes,
    distanceM,
    maxDistanceM,
    partnerLabel,
    skipStep3 = false,
  } = input;

  if (mustSelectSchedule) {
    if (bothVisitLinkOptions && visitLinkMode === null) {
      return {
        valid: false,
        error: 'Choose planned visit or weekly route.',
      };
    }
    if (acceptedSchedulesLength > 0 && hasWeeklyRouteToday) {
      return {
        valid: false,
        error: 'Select a planned visit or weekly route, then a customer.',
      };
    }
    if (hasWeeklyRouteToday) {
      return {
        valid: false,
        error: 'Select your route, then a customer.',
      };
    }
    if (acceptedSchedulesLength > 0) {
      return {
        valid: false,
        error: 'Select a planned visit (today or earlier).',
      };
    }
    return {
      valid: false,
      error: 'No eligible route/schedule found for this visit.',
    };
  }
  // Schedule and route are optional: backend allows farmer-only visits (unplanned field stop).
  if (!selectedFarmerId || !selectedFarmId || !location) {
    return { valid: false, error: `Select ${partnerLabel.toLowerCase()}, location, and wait for GPS.` };
  }
  if (photoUrisLength === 0) {
    return { valid: false, error: 'Add at least one photo.' };
  }
  if (distanceM !== null && distanceM > maxDistanceM) {
    return {
      valid: false,
      error: `Too far (${distanceM}m; max ${maxDistanceM}m). Move closer to the ${partnerLabel.toLowerCase()}.`,
    };
  }
  if (activityTypes.length === 0) {
    return { valid: false, error: 'Pick at least one activity.' };
  }
  const allowedValues = new Set(activityTypesList.map((a) => a.value));
  const invalidActivity = activityTypes.find((a) => !allowedValues.has(a));
  if (invalidActivity) {
    return { valid: false, error: 'Pick an activity from the list.' };
  }
  if (notes.length > FIELD_MAX_LENGTHS.notes) {
    return { valid: false, error: `Notes must be ${FIELD_MAX_LENGTHS.notes} characters or fewer.` };
  }
  if (!skipStep3) {
    for (const f of step3Fields) {
      const val = (step3Values[f.key] ?? '').trim();
      if (f.required && !val) {
        return { valid: false, error: `"${f.label}" is required.` };
      }
      const schema = visitFormFieldSchema?.[f.key];
      if (f.key === 'stockist_payment_amount' && val !== '') {
        const n = parseFloat(val);
        if (Number.isNaN(n)) {
          return { valid: false, error: `"${f.label}" must be a number.` };
        }
        if (n < 0) {
          return { valid: false, error: `"${f.label}" cannot be negative.` };
        }
      }
      if (schema?.value_type === 'number' && val !== '') {
        const n = parseFloat(val);
        if (Number.isNaN(n)) {
          return { valid: false, error: `"${f.label}" must be a number.` };
        }
      }
      if (schema?.value_type === 'integer' && val !== '') {
        const n = parseFloat(val);
        if (Number.isNaN(n) || !Number.isInteger(n)) {
          return { valid: false, error: `"${f.label}" must be a whole number.` };
        }
      }
      const maxLen = FIELD_MAX_LENGTHS[f.key];
      if (maxLen != null && val.length > maxLen) {
        return { valid: false, error: `"${f.label}" must be ${maxLen} characters or fewer.` };
      }
    }
  }
  return { valid: true };
}
