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
  VISITS: "/visits",
  SCHEDULES: "/schedules",
  STAFF: "/staff",
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

/** Roles that can create schedules */
export const ROLES_CAN_CREATE_SCHEDULES: readonly UserRole[] = [
  ROLES.ADMIN,
  ROLES.SUPERVISOR,
];

/** Roles that can list visits (admins and supervisors only) */
export const ROLES_CAN_LIST_VISITS: readonly UserRole[] = [
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
