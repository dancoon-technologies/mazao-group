import { describe, it, expect } from "vitest";
import { reportDataToRemarks } from "./routeReportText";

describe("reportDataToRemarks", () => {
  it("prefers remarks key", () => {
    expect(reportDataToRemarks({ remarks: "  Done  " })).toBe("Done");
  });

  it("falls back to summary", () => {
    expect(reportDataToRemarks({ summary: "Busy day" })).toContain("Busy day");
  });
});
