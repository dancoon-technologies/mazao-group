/**
 * Shared report date period and visit list filter params.
 * Used by Visits and Sales pages so date logic and API params stay in one place.
 */

export type ReportPeriod = "daily" | "weekly" | "monthly";

export const REPORT_PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/** Params for GET /api/visits/ (date range, officer, department). */
export interface VisitFilterParams {
  date?: string;
  date_from?: string;
  date_to?: string;
  officer?: string;
  department?: string;
}

/** ISO date string for today (YYYY-MM-DD). */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Week bounds (Monday–Sunday) for a given date string. */
export function getWeekBounds(dateStr: string): { from: string; to: string } {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  const from = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 6);
  const to = d.toISOString().slice(0, 10);
  return { from, to };
}

/** Month bounds for a given YYYY-MM or YYYY-MM-DD string. */
export function getMonthBounds(ym: string): { from: string; to: string } {
  const from = ym.slice(0, 7) + "-01";
  const d = new Date(from + "T12:00:00");
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  const to = d.toISOString().slice(0, 10);
  return { from, to };
}

/**
 * Build query params for GET /api/visits/ from UI filters.
 * Admin-only: pass departmentFilter when isAdmin; otherwise omit.
 */
export function buildVisitParams(
  period: ReportPeriod,
  reportDate: string,
  options: {
    officerFilter: string | null;
    departmentFilter: string | null;
    isAdmin: boolean;
  }
): VisitFilterParams {
  const { officerFilter, departmentFilter, isAdmin } = options;
  const base: VisitFilterParams = {};
  if (officerFilter) base.officer = officerFilter;
  if (isAdmin && departmentFilter) base.department = departmentFilter;

  if (period === "daily") {
    return { ...base, date: reportDate };
  }
  if (period === "weekly") {
    const { from, to } = getWeekBounds(reportDate);
    return { ...base, date_from: from, date_to: to };
  }
  const { from, to } = getMonthBounds(reportDate.slice(0, 7));
  return { ...base, date_from: from, date_to: to };
}

/** Human-readable label for the current period (e.g. "Daily report — 2025-03-14"). */
export function getReportPeriodLabel(period: ReportPeriod, reportDate: string): string {
  if (period === "daily") return `Daily report — ${reportDate}`;
  if (period === "weekly") {
    const { from, to } = getWeekBounds(reportDate);
    return `Weekly report — ${from} to ${to}`;
  }
  const [y, m] = reportDate.slice(0, 7).split("-");
  const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleString("default", { month: "long" });
  return `Monthly report — ${monthName} ${y}`;
}

/** Short label for exports (e.g. "daily-2025-03-14"). */
export function getReportPeriodShortLabel(period: ReportPeriod, reportDate: string): string {
  if (period === "daily") return `Daily — ${reportDate}`;
  if (period === "weekly") {
    const { from, to } = getWeekBounds(reportDate);
    return `Weekly — ${from} to ${to}`;
  }
  const [y, m] = reportDate.slice(0, 7).split("-");
  const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleString("default", { month: "long" });
  return `Monthly — ${monthName} ${y}`;
}

/** Base filename for exports (e.g. "visits-daily-2025-03-14"). */
export function getExportFilenameBase(
  prefix: string,
  period: ReportPeriod,
  reportDate: string
): string {
  if (period === "daily") return `${prefix}-daily-${reportDate}`;
  if (period === "weekly") {
    const { from, to } = getWeekBounds(reportDate);
    return `${prefix}-weekly-${from}-to-${to}`;
  }
  return `${prefix}-monthly-${reportDate.slice(0, 7)}`;
}
