import { describe, it, expect } from "vitest";
import {
  REPORT_PERIOD_OPTIONS,
  todayISO,
  getWeekBounds,
  getMonthBounds,
  buildVisitParams,
  getReportPeriodLabel,
  getReportPeriodShortLabel,
  getExportFilenameBase,
} from "./reportFilters";

describe("reportFilters", () => {
  describe("REPORT_PERIOD_OPTIONS", () => {
    it("has daily, weekly, monthly", () => {
      expect(REPORT_PERIOD_OPTIONS.map((o) => o.value)).toEqual([
        "daily",
        "weekly",
        "monthly",
      ]);
    });
  });

  describe("todayISO", () => {
    it("returns YYYY-MM-DD format", () => {
      const s = todayISO();
      expect(/^\d{4}-\d{2}-\d{2}$/.test(s)).toBe(true);
    });
  });

  describe("getWeekBounds", () => {
    it("returns Monday and Sunday for a date in the week", () => {
      // 2024-03-14 is Thursday
      const { from, to } = getWeekBounds("2024-03-14");
      expect(from).toBe("2024-03-11"); // Monday
      expect(to).toBe("2024-03-17"); // Sunday
    });

    it("handles Sunday (week starts Monday)", () => {
      const { from, to } = getWeekBounds("2024-03-17");
      expect(from).toBe("2024-03-11");
      expect(to).toBe("2024-03-17");
    });
  });

  describe("getMonthBounds", () => {
    it("returns first and last day of month", () => {
      const { from, to } = getMonthBounds("2024-03");
      expect(from).toBe("2024-03-01");
      expect(to).toBe("2024-03-31");
    });

    it("accepts YYYY-MM-DD", () => {
      const { from, to } = getMonthBounds("2024-02-15");
      expect(from).toBe("2024-02-01");
      expect(to).toBe("2024-02-29"); // leap year
    });
  });

  describe("buildVisitParams", () => {
    it("daily returns date only", () => {
      const params = buildVisitParams("daily", "2024-03-14", {
        officerFilter: null,
        departmentFilter: null,
        isAdmin: false,
      });
      expect(params).toEqual({ date: "2024-03-14" });
    });

    it("weekly returns date_from and date_to", () => {
      const params = buildVisitParams("weekly", "2024-03-14", {
        officerFilter: null,
        departmentFilter: null,
        isAdmin: false,
      });
      expect(params.date_from).toBe("2024-03-11");
      expect(params.date_to).toBe("2024-03-17");
      expect(params.date).toBeUndefined();
    });

    it("monthly uses reportDate slice for month", () => {
      const params = buildVisitParams("monthly", "2024-03-15", {
        officerFilter: null,
        departmentFilter: null,
        isAdmin: false,
      });
      expect(params.date_from).toBe("2024-03-01");
      expect(params.date_to).toBe("2024-03-31");
    });

    it("adds officer when officerFilter set", () => {
      const params = buildVisitParams("daily", "2024-03-14", {
        officerFilter: "user-uuid",
        departmentFilter: null,
        isAdmin: false,
      });
      expect(params.officer).toBe("user-uuid");
    });

    it("adds department only when isAdmin and departmentFilter set", () => {
      const params = buildVisitParams("daily", "2024-03-14", {
        officerFilter: null,
        departmentFilter: "agriprice",
        isAdmin: true,
      });
      expect(params.department).toBe("agriprice");
    });

    it("omits department when not admin", () => {
      const params = buildVisitParams("daily", "2024-03-14", {
        officerFilter: null,
        departmentFilter: "agriprice",
        isAdmin: false,
      });
      expect(params.department).toBeUndefined();
    });
  });

  describe("getReportPeriodLabel", () => {
    it("daily includes date", () => {
      expect(getReportPeriodLabel("daily", "2024-03-14")).toContain("2024-03-14");
      expect(getReportPeriodLabel("daily", "2024-03-14")).toContain("Daily report");
    });

    it("weekly includes date range", () => {
      const label = getReportPeriodLabel("weekly", "2024-03-14");
      expect(label).toContain("2024-03-11");
      expect(label).toContain("2024-03-17");
    });

    it("monthly includes month name and year", () => {
      const label = getReportPeriodLabel("monthly", "2024-03-01");
      expect(label).toContain("March");
      expect(label).toContain("2024");
    });
  });

  describe("getReportPeriodShortLabel", () => {
    it("daily format", () => {
      expect(getReportPeriodShortLabel("daily", "2024-03-14")).toBe("Daily — 2024-03-14");
    });
  });

  describe("getExportFilenameBase", () => {
    it("includes prefix and period", () => {
      const name = getExportFilenameBase("visits", "daily", "2024-03-14");
      expect(name).toBe("visits-daily-2024-03-14");
    });

    it("weekly includes date range", () => {
      const name = getExportFilenameBase("sales", "weekly", "2024-03-14");
      expect(name).toContain("sales-weekly");
      expect(name).toContain("2024-03-11");
      expect(name).toContain("2024-03-17");
    });

    it("monthly uses YYYY-MM", () => {
      const name = getExportFilenameBase("visits", "monthly", "2024-03-15");
      expect(name).toBe("visits-monthly-2024-03");
    });
  });
});
