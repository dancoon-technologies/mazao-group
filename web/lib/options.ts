/**
 * Options from GET /api/options/ (labels, departments, activity_types, etc.).
 * Partner/location labels are admin-configurable: Site config (global) or
 * Department terminology (per department) in Django admin.
 */

import type { OptionsResponse, PartnerLocationLabels } from "./types";

export const DEFAULT_PARTNER_LOCATION_LABELS: PartnerLocationLabels = {
  partner: "Farmer",
  location: "Farm",
};

/**
 * Get partner/location labels from options response.
 * Used for table headers and copy (Farmer/Farm vs Stockist/Outlet).
 */
export function getLabelsFromOptions(
  options: OptionsResponse | null | undefined
): PartnerLocationLabels {
  if (
    options?.labels?.partner != null &&
    options?.labels?.location != null &&
    options.labels.partner !== "" &&
    options.labels.location !== ""
  ) {
    return {
      partner: options.labels.partner,
      location: options.labels.location,
    };
  }
  return DEFAULT_PARTNER_LOCATION_LABELS;
}
