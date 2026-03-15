import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARTNER_LOCATION_LABELS,
  getLabelsFromOptions,
} from "./options";

describe("options", () => {
  describe("DEFAULT_PARTNER_LOCATION_LABELS", () => {
    it("is Farmer and Farm", () => {
      expect(DEFAULT_PARTNER_LOCATION_LABELS).toEqual({
        partner: "Farmer",
        location: "Farm",
      });
    });
  });

  describe("getLabelsFromOptions", () => {
    it("returns default when options is null", () => {
      expect(getLabelsFromOptions(null)).toEqual(DEFAULT_PARTNER_LOCATION_LABELS);
    });

    it("returns default when options is undefined", () => {
      expect(getLabelsFromOptions(undefined)).toEqual(DEFAULT_PARTNER_LOCATION_LABELS);
    });

    it("returns default when labels missing", () => {
      expect(getLabelsFromOptions({ departments: [], staff_roles: [] })).toEqual(
        DEFAULT_PARTNER_LOCATION_LABELS
      );
    });

    it("returns default when partner or location empty string", () => {
      expect(
        getLabelsFromOptions({
          departments: [],
          staff_roles: [],
          labels: { partner: "", location: "Farm" },
        })
      ).toEqual(DEFAULT_PARTNER_LOCATION_LABELS);
      expect(
        getLabelsFromOptions({
          departments: [],
          staff_roles: [],
          labels: { partner: "Stockist", location: "" },
        })
      ).toEqual(DEFAULT_PARTNER_LOCATION_LABELS);
    });

    it("returns options labels when both set", () => {
      expect(
        getLabelsFromOptions({
          departments: [],
          staff_roles: [],
          labels: { partner: "Stockist", location: "Outlet" },
        })
      ).toEqual({ partner: "Stockist", location: "Outlet" });
    });
  });
});
