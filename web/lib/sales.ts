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
 * Flatten visits with product_lines into one row per product line (sold or given).
 * Skips lines where both quantity_sold and quantity_given are zero.
 */
export function flattenVisitsToSales(visits: Visit[]): SalesRow[] {
  const rows: SalesRow[] = [];
  for (const v of visits) {
    const lines = v.product_lines ?? [];
    const officerDisplay =
      [v.officer_display_name, v.officer_email].filter(Boolean).join(" — ") || "—";
    const partnerDisplay = v.farmer_display_name ?? v.farmer ?? "—";
    const locationDisplay = v.farm_display_name ?? v.farm ?? "—";
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const sold = line.quantity_sold ?? "0";
      const given = line.quantity_given ?? "0";
      if (sold === "0" && given === "0") continue;
      rows.push({
        id: `${v.id}-${line.product_id ?? idx}`,
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
  }
  return rows;
}
