import { describe, it, expect } from "vitest";
import {
  getVisitValueKey,
  buildAdditionalVisitFieldsFromOptions,
  buildVisitDataFieldsFromOptions,
} from "./visitFormFields";

describe("visitFormFields", () => {
  describe("getVisitValueKey", () => {
    it("returns the same key", () => {
      expect(getVisitValueKey("merchandising")).toBe("merchandising");
      expect(getVisitValueKey("order_value")).toBe("order_value");
      expect(getVisitValueKey("product_lines")).toBe("product_lines");
    });
  });

  describe("buildAdditionalVisitFieldsFromOptions", () => {
    it("returns empty when activityTypes undefined", () => {
      expect(buildAdditionalVisitFieldsFromOptions(undefined)).toEqual([]);
    });

    it("returns empty when activityTypes empty", () => {
      expect(buildAdditionalVisitFieldsFromOptions([])).toEqual([]);
    });

    it("includes all form_fields from backend", () => {
      const result = buildAdditionalVisitFieldsFromOptions([
        {
          value: "stockists_visit",
          label: "Stockists visit",
          form_fields: [
            { key: "order_value", label: "Total Sales" },
            { key: "number_of_stockists_visited", label: "Number visited" },
          ],
        },
      ]);
      expect(result.map((f) => f.key)).toContain("order_value");
      expect(result.map((f) => f.key)).toContain("number_of_stockists_visited");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ key: "order_value", label: "Total Sales" });
      expect(result[1]).toEqual({
        key: "number_of_stockists_visited",
        label: "Number visited",
      });
    });

    it("dedupes by key, first label wins", () => {
      const result = buildAdditionalVisitFieldsFromOptions([
        {
          value: "a",
          label: "A",
          form_fields: [{ key: "merchandising", label: "First label" }],
        },
        {
          value: "b",
          label: "B",
          form_fields: [{ key: "merchandising", label: "Second label" }],
        },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("First label");
    });

    it("includes product_lines, merchandising, counter_training", () => {
      const result = buildAdditionalVisitFieldsFromOptions([
        {
          value: "stockists_visit",
          label: "Stockists visit",
          form_fields: [
            { key: "product_lines", label: "Products" },
            { key: "merchandising", label: "Merchandising" },
            { key: "counter_training", label: "Counter training" },
          ],
        },
      ]);
      expect(result).toHaveLength(3);
      expect(result.map((f) => f.key)).toEqual([
        "product_lines",
        "merchandising",
        "counter_training",
      ]);
    });
  });

  describe("buildVisitDataFieldsFromOptions", () => {
    it("substitutes {partner} in labels with partnerLabel", () => {
      const result = buildVisitDataFieldsFromOptions(
        [
          {
            value: "farm",
            label: "Farm visit",
            form_fields: [
              { key: "farmers_feedback", label: "{partner}'s feedback" },
            ],
          },
        ],
        "Farmer"
      );
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Farmer's feedback");
    });
  });
});
