import { describe, it, expect } from "vitest";
import {
  STANDARD_VISIT_FIELD_KEYS,
  getVisitValueKey,
  buildAdditionalVisitFieldsFromOptions,
} from "./visitFormFields";

describe("visitFormFields", () => {
  describe("STANDARD_VISIT_FIELD_KEYS", () => {
    it("includes crop_stage, order_value, farmers_feedback", () => {
      expect(STANDARD_VISIT_FIELD_KEYS.has("crop_stage")).toBe(true);
      expect(STANDARD_VISIT_FIELD_KEYS.has("order_value")).toBe(true);
      expect(STANDARD_VISIT_FIELD_KEYS.has("farmers_feedback")).toBe(true);
    });

    it("excludes product_focus and number_of_stockists_visited", () => {
      expect(STANDARD_VISIT_FIELD_KEYS.has("product_focus")).toBe(false);
      expect(STANDARD_VISIT_FIELD_KEYS.has("number_of_stockists_visited")).toBe(false);
    });
  });

  describe("getVisitValueKey", () => {
    it("maps product_focus to product_focus_display", () => {
      expect(getVisitValueKey("product_focus")).toBe("product_focus_display");
    });

    it("returns same key for others", () => {
      expect(getVisitValueKey("merchandising")).toBe("merchandising");
      expect(getVisitValueKey("order_value")).toBe("order_value");
    });
  });

  describe("buildAdditionalVisitFieldsFromOptions", () => {
    it("returns empty when activityTypes undefined", () => {
      expect(buildAdditionalVisitFieldsFromOptions(undefined)).toEqual([]);
    });

    it("returns empty when activityTypes empty", () => {
      expect(buildAdditionalVisitFieldsFromOptions([])).toEqual([]);
    });

    it("excludes standard keys", () => {
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
      expect(result.map((f) => f.key)).not.toContain("order_value");
      expect(result.map((f) => f.key)).toContain("number_of_stockists_visited");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
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

    it("includes product_focus, merchandising, counter_training", () => {
      const result = buildAdditionalVisitFieldsFromOptions([
        {
          value: "stockists_visit",
          label: "Stockists visit",
          form_fields: [
            { key: "product_focus", label: "Product focus" },
            { key: "merchandising", label: "Merchandising" },
            { key: "counter_training", label: "Counter training" },
          ],
        },
      ]);
      expect(result).toHaveLength(3);
      expect(result.map((f) => f.key)).toEqual([
        "product_focus",
        "merchandising",
        "counter_training",
      ]);
    });
  });
});
