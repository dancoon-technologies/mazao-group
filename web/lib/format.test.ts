import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDateTime,
  pluralize,
  formatActivityType,
  formatLatLng,
} from "./format";

describe("formatDate", () => {
  it("formats ISO date string to locale date", () => {
    expect(formatDate("2024-03-14")).toBe(
      new Date("2024-03-14").toLocaleDateString()
    );
  });

  it("handles ISO datetime string", () => {
    const iso = "2024-03-14T12:00:00.000Z";
    expect(formatDate(iso)).toBe(new Date(iso).toLocaleDateString());
  });
});

describe("formatDateTime", () => {
  it("formats ISO string with medium date and short time", () => {
    const iso = "2024-03-14T15:30:00.000Z";
    expect(formatDateTime(iso)).toBe(
      new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    );
  });
});

describe("pluralize", () => {
  it("returns singular with count 1", () => {
    expect(pluralize(1, "visit")).toBe("1 visit");
  });

  it("returns plural default (s suffix) when count !== 1", () => {
    expect(pluralize(0, "visit")).toBe("0 visits");
    expect(pluralize(2, "visit")).toBe("2 visits");
  });

  it("uses custom plural when provided", () => {
    expect(pluralize(2, "person", "people")).toBe("2 people");
  });
});

describe("formatActivityType", () => {
  it("returns em dash for empty value", () => {
    expect(formatActivityType("")).toBe("—");
  });

  it("humanizes snake_case (title case per word)", () => {
    expect(formatActivityType("farm_to_farm_visits")).toBe(
      "Farm To Farm Visits"
    );
  });

  it("handles single word", () => {
    expect(formatActivityType("training")).toBe("Training");
  });
});

describe("formatLatLng", () => {
  it("formats number lat/lng to 5 decimals", () => {
    expect(formatLatLng(-6.123456, 39.654321)).toBe("-6.12346, 39.65432");
  });

  it("formats string lat/lng from API", () => {
    expect(formatLatLng("-6.0", "39.0")).toBe("-6.00000, 39.00000");
  });

  it("uses custom decimals", () => {
    expect(formatLatLng(-6.1, 39.2, 2)).toBe("-6.10, 39.20");
  });

  it("returns — for null", () => {
    expect(formatLatLng(null, 39)).toBe("—");
    expect(formatLatLng(-6, null)).toBe("—");
    expect(formatLatLng(null, null)).toBe("—");
  });

  it("returns — for undefined", () => {
    expect(formatLatLng(undefined, 39)).toBe("—");
    expect(formatLatLng(-6, undefined)).toBe("—");
  });

  it("returns — for NaN", () => {
    expect(formatLatLng(Number.NaN, 39)).toBe("—");
    expect(formatLatLng(-6, Number.NaN)).toBe("—");
  });

  it("returns — for invalid string", () => {
    expect(formatLatLng("not a number", 39)).toBe("—");
  });
});
