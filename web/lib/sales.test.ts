import { describe, it, expect } from "vitest";
import { flattenVisitsToSales } from "./sales";
import type { Visit } from "./types";

function makeVisit(overrides: Partial<Visit> & { id: string }): Visit {
  return {
    officer: "officer-uuid",
    farmer: "farmer-uuid",
    farm: null,
    latitude: "-6",
    longitude: "39",
    photo: "",
    notes: "",
    distance_from_farmer: 0,
    verification_status: "pending",
    activity_type: "farm_to_farm_visits",
    created_at: "2024-03-14T12:00:00Z",
    officer_display_name: "Jane Officer",
    officer_email: "jane@test.com",
    farmer_display_name: "John Farmer",
    farm_display_name: null,
    ...overrides,
  };
}

describe("flattenVisitsToSales", () => {
  it("returns empty array for no visits", () => {
    expect(flattenVisitsToSales([])).toEqual([]);
  });

  it("returns empty when visit has no product_lines", () => {
    const visits = [makeVisit({ id: "v1" })];
    expect(flattenVisitsToSales(visits)).toEqual([]);
  });

  it("skips lines where both quantity_sold and quantity_given are zero", () => {
    const visits = [
      makeVisit({
        id: "v1",
        product_lines: [
          {
            product_id: "p1",
            product_name: "Product A",
            quantity_sold: "0",
            quantity_given: "0",
          },
        ],
      }),
    ];
    expect(flattenVisitsToSales(visits)).toHaveLength(0);
  });

  it("emits one row per product line with sold or given", () => {
    const visits = [
      makeVisit({
        id: "v1",
        officer_display_name: "Jane",
        officer_email: "jane@test.com",
        farmer_display_name: "John",
        farm_display_name: "North Farm",
        product_lines: [
          {
            product_id: "p1",
            product_name: "Seeds",
            product_unit: "kg",
            quantity_sold: "10",
            quantity_given: "0",
          },
          {
            product_id: "p2",
            product_name: "Fertilizer",
            quantity_sold: "0",
            quantity_given: "2",
          },
        ],
      }),
    ];
    const rows = flattenVisitsToSales(visits);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      visitId: "v1",
      date: "2024-03-14T12:00:00Z",
      officerDisplay: "Jane — jane@test.com",
      partnerDisplay: "John",
      locationDisplay: "North Farm",
      productName: "Seeds",
      productUnit: "kg",
      quantitySold: "10",
      quantityGiven: "0",
    });
    expect(rows[0].id).toBe("v1-line-p1");
    expect(rows[1]).toMatchObject({
      productName: "Fertilizer",
      quantitySold: "0",
      quantityGiven: "2",
    });
  });

  it("emits one row per product focus when no product_lines (product focus as sale)", () => {
    const visits = [
      makeVisit({
        id: "v1",
        officer_display_name: "Jane",
        farmer_display_name: "John",
        farm_display_name: "North Farm",
        product_lines: [],
        product_focus_details: [
          { product_id: "p1", product_name: "Seeds", product_unit: "kg" },
          { product_id: "p2", product_name: "Fertilizer", product_unit: "" },
        ],
      }),
    ];
    const rows = flattenVisitsToSales(visits);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      visitId: "v1",
      productName: "Seeds",
      productUnit: "kg",
      quantitySold: "—",
      quantityGiven: "—",
    });
    expect(rows[0].id).toBe("v1-focus-p1");
    expect(rows[1]).toMatchObject({
      productName: "Fertilizer",
      quantitySold: "—",
      quantityGiven: "—",
    });
  });

  it("does not duplicate product focus when same product in product_lines", () => {
    const visits = [
      makeVisit({
        id: "v1",
        product_lines: [
          {
            product_id: "p1",
            product_name: "Seeds",
            product_unit: "kg",
            quantity_sold: "5",
            quantity_given: "0",
          },
        ],
        product_focus_details: [
          { product_id: "p1", product_name: "Seeds", product_unit: "kg" },
        ],
      }),
    ];
    const rows = flattenVisitsToSales(visits);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantitySold).toBe("5");
  });

  it("uses fallbacks when display names missing", () => {
    const visits = [
      makeVisit({
        id: "v1",
        officer_display_name: undefined,
        officer_email: undefined,
        farmer_display_name: undefined,
        farm_display_name: undefined,
        product_lines: [
          {
            product_id: "p1",
            product_name: "X",
            quantity_sold: "1",
            quantity_given: "0",
          },
        ],
      }),
    ];
    const rows = flattenVisitsToSales(visits);
    expect(rows[0].officerDisplay).toBe("—");
    expect(rows[0].partnerDisplay).toBe("—");
    expect(rows[0].locationDisplay).toBe("—");
  });
});
