/**
 * Sales data derived from visits (product_lines).
 * Used by the Sales page; keeps flattening logic in one place for consistency and testing.
 */

import type { Visit } from "./types";

export interface SalesRow {
  id: string;
  visitId: string;
  date: string;
  officerDisplay: string;
  partnerDisplay: string;
  locationDisplay: string;
  productName: string;
  productUnit: string;
  quantitySold: string;
  quantityGiven: string;
}

/**
 * Flatten visits into sales rows:
 * - product_lines: one row per line with quantity_sold/quantity_given (skips 0/0).
 * - product_focus_details: one row per product focus (no quantities, shown as "—") so visits
 *   recorded with product focus appear on the sales page.
 */
export function flattenVisitsToSales(visits: Visit[]): SalesRow[] {
  const rows: SalesRow[] = [];
  for (const v of visits) {
    const officerDisplay =
      [v.officer_display_name, v.officer_email].filter(Boolean).join(" — ") || "—";
    const partnerDisplay = v.farmer_display_name ?? "\u2014";
    const locationDisplay = v.farm_display_name ?? "\u2014";

    const lines = v.product_lines ?? [];
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const sold = line.quantity_sold ?? "0";
      const given = line.quantity_given ?? "0";
      if (sold === "0" && given === "0") continue;
      rows.push({
        id: `${v.id}-line-${line.product_id ?? idx}`,
        visitId: v.id,
        date: v.created_at,
        officerDisplay,
        partnerDisplay,
        locationDisplay,
        productName: line.product_name ?? "—",
        productUnit: line.product_unit ?? "",
        quantitySold: sold,
        quantityGiven: given,
      });
    }

    const focusDetails = v.product_focus_details ?? [];
    const lineProductIds = new Set(lines.map((l) => l.product_id));
    for (let idx = 0; idx < focusDetails.length; idx++) {
      const detail = focusDetails[idx];
      if (lineProductIds.has(detail.product_id)) continue;
      rows.push({
        id: `${v.id}-focus-${detail.product_id}`,
        visitId: v.id,
        date: v.created_at,
        officerDisplay,
        partnerDisplay,
        locationDisplay,
        productName: detail.product_name ?? "—",
        productUnit: detail.product_unit ?? "",
        quantitySold: "—",
        quantityGiven: "—",
      });
    }
  }
  return rows;
}
