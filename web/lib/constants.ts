import type { UserRole } from "./types";

/** Shared UI constants (Clean Code: avoid magic strings/numbers) */
export const LOADER_COLOR = "green" as const;
export const PAGE_BOX_MIN_WIDTH = 0;

/** App route paths (single source of truth for URLs) */
export const ROUTES = {
  LOGIN: "/login",
  CHANGE_PASSWORD: "/change-password",
  DASHBOARD: "/dashboard",
  FARMERS: "/farmers",
  STOCKISTS: "/stockists",
  FARMS: "/farms",
  OUTLETS: "/outlets",
  VISITS: "/visits",
  SALES: "/sales",
  SCHEDULES: "/schedules",
  STAFF: "/staff",
  TRACKING: "/tracking",
  MAINTENANCE: "/maintenance",
} as const;

/** Role identifiers (single source of truth; match backend) */
export const ROLES = {
  ADMIN: "admin",
  SUPERVISOR: "supervisor",
  OFFICER: "officer",
} as const satisfies Record<string, UserRole>;

/** Roles that can access the dashboard */
export const ROLES_CAN_ACCESS_DASHBOARD: readonly UserRole[] = [
  ROLES.ADMIN,
  ROLES.SUPERVISOR,
];

/** Roles that can create schedules (admin/supervisor: create for an officer; officer: propose for self) */
export const ROLES_CAN_CREATE_SCHEDULES: readonly UserRole[] = [
  ROLES.ADMIN,
  ROLES.SUPERVISOR,
  ROLES.OFFICER,
];

/** Roles that can list visits (admins and supervisors only) */
export const ROLES_CAN_LIST_VISITS: readonly UserRole[] = [
  ROLES.ADMIN,
  ROLES.SUPERVISOR,
];

/** Roles that can access team tracking (location reports) */
export const ROLES_TRACKING: readonly UserRole[] = [
  ROLES.ADMIN,
  ROLES.SUPERVISOR,
];

/** Roles that can access Schedules page (all authenticated) */
export const ROLES_SCHEDULES_PAGE: readonly UserRole[] = [
  ROLES.ADMIN,
  ROLES.SUPERVISOR,
  ROLES.OFFICER,
];

/** Roles that can access Staff page */
export const ROLES_STAFF_PAGE: readonly UserRole[] = [ROLES.ADMIN];

/** Staff roles (supervisor, officer) for registration */
export const ROLES_STAFF: readonly UserRole[] = [
  ROLES.SUPERVISOR,
  ROLES.OFFICER,
];

/** Dashboard chart: visits-by-day allowed range and default */
export const DASHBOARD_VISITS_DAYS_MIN = 7;
export const DASHBOARD_VISITS_DAYS_MAX = 90;
export const DASHBOARD_VISITS_DAYS_DEFAULT = 14;

/** Dashboard chart: day range options for the selector */
export const DASHBOARD_DAY_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
] as const;
