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
}

/**
 * Flatten visits into sales rows. Sales are taken only from product_lines (Products):
 * one row per line with quantity_sold (skips 0).
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
      if (sold === "0") continue;
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
      });
    }
  }
  return rows;
}

/** One product line for display in a visit row (accordion). */
export interface SalesProductLine {
  productName: string;
  productUnit: string;
  quantitySold: string;
}

/** Visit grouped for sales page: one row per visit with expandable product list. */
export interface SalesVisitGroup {
  visitId: string;
  date: string;
  officerDisplay: string;
  partnerDisplay: string;
  locationDisplay: string;
  products: SalesProductLine[];
}

/**
 * Group visits into one row per visit with a list of products (for accordion UI).
 * Sales are taken only from product_lines (Products) with quantity sold.
 */
export function groupSalesByVisit(visits: Visit[]): SalesVisitGroup[] {
  const groups: SalesVisitGroup[] = [];
  for (const v of visits) {
    const officerDisplay =
      [v.officer_display_name, v.officer_email].filter(Boolean).join(" — ") || "—";
    const partnerDisplay = v.farmer_display_name ?? "\u2014";
    const locationDisplay = v.farm_display_name ?? "\u2014";

    const products: SalesProductLine[] = [];
    const lines = v.product_lines ?? [];
    for (const line of lines) {
      const sold = line.quantity_sold ?? "0";
      if (sold === "0") continue;
      products.push({
        productName: line.product_name ?? "—",
        productUnit: line.product_unit ?? "",
        quantitySold: sold,
      });
    }

    if (products.length === 0) continue;
    groups.push({
      visitId: v.id,
      date: v.created_at,
      officerDisplay,
      partnerDisplay,
      locationDisplay,
      products,
    });
  }
  return groups;
}
