import type { UserRole } from "@/lib/types";
import {
  ROUTES,
  ROLES_CAN_ACCESS_DASHBOARD,
  ROLES_SCHEDULES_PAGE,
  ROLES_STAFF_PAGE,
  ROLES_CAN_LIST_VISITS,
} from "@/lib/constants";

export interface NavItem {
  href: string;
  label: string;
  roles?: readonly UserRole[];
}

export const APP_NAV: NavItem[] = [
  { href: ROUTES.DASHBOARD, label: "Dashboard" },
  { href: ROUTES.FARMERS, label: "Farmers" },
  { href: ROUTES.VISITS, label: "Visits", roles: ROLES_CAN_LIST_VISITS },
  { href: ROUTES.SCHEDULES, label: "Schedules", roles: ROLES_SCHEDULES_PAGE },
  { href: ROUTES.STAFF, label: "Staff", roles: ROLES_STAFF_PAGE },
];

export function filterNavByRole(
  nav: NavItem[],
  role: UserRole | null,
  canAccessDashboard: boolean
): NavItem[] {
  return nav.filter((item) => {
    if (item.href === ROUTES.DASHBOARD && !canAccessDashboard) return false;
    if (item.roles && role && !item.roles.includes(role)) return false;
    return true;
  });
}
