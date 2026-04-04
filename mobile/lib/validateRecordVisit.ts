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
  selectedFarmerId: string | null;
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
    selectedFarmerId,
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
    if (acceptedSchedulesLength > 0 && hasWeeklyRouteToday) {
      return {
        valid: false,
        error:
          'Select a planned visit (accepted schedule) or today’s route plan, then choose farmer or stockist.',
      };
    }
    if (hasWeeklyRouteToday) {
      return {
        valid: false,
        error:
          'Select which route you are on (or use “Record from here”), then choose farmer or stockist.',
      };
    }
    if (acceptedSchedulesLength > 0) {
      return {
        valid: false,
        error: 'Select a planned visit (accepted schedule) with date today or in the past.',
      };
    }
    return {
      valid: false,
      error:
        'You need an accepted schedule for today or a past date, or a weekly route for today, to record this visit.',
    };
  }
  // Schedule and route are optional: backend allows farmer-only visits (unplanned field stop).
  if (!selectedFarmerId || !location) {
    return { valid: false, error: `Select ${partnerLabel.toLowerCase()} and ensure location is available.` };
  }
  if (photoUrisLength === 0) {
    return { valid: false, error: 'Capture at least one photo for verification.' };
  }
  if (distanceM !== null && distanceM > maxDistanceM) {
    return {
      valid: false,
      error: `You must be within ${maxDistanceM}m of the ${partnerLabel.toLowerCase()}/${partnerLabel.toLowerCase()}'s location to record this visit. You are ${distanceM}m away.`,
    };
  }
  if (activityTypes.length === 0) {
    return { valid: false, error: 'Select at least one activity type.' };
  }
  const allowedValues = new Set(activityTypesList.map((a) => a.value));
  const invalidActivity = activityTypes.find((a) => !allowedValues.has(a));
  if (invalidActivity) {
    return { valid: false, error: 'Selected activity type is not allowed for your department. Please choose from the list.' };
  }
  if (notes.length > FIELD_MAX_LENGTHS.notes) {
    return { valid: false, error: `Notes must be ${FIELD_MAX_LENGTHS.notes} characters or fewer.` };
  }
  for (const f of step3Fields) {
    const val = (step3Values[f.key] ?? '').trim();
    if (f.required && !val) {
      return { valid: false, error: `Additional details: "${f.label}" is required.` };
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
  return { valid: true };
}
