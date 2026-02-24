import type { UserRole } from "@/lib/types";
import {
  ROUTES,
  ROLES_CAN_ACCESS_DASHBOARD,
  ROLES_SCHEDULES_PAGE,
  ROLES_STAFF_PAGE,
  ROLES_CAN_LIST_VISITS,
} from "@/lib/constants";
import { IconHome, IconUser, IconBuilding, IconClipboardList, IconCalendar, IconUsers } from "@tabler/icons-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof IconHome | typeof IconUser | typeof IconBuilding | typeof IconClipboardList | typeof IconCalendar | typeof IconUsers;
  roles?: readonly UserRole[];
}

export const APP_NAV: NavItem[] = [
  { href: ROUTES.DASHBOARD, label: "Dashboard", icon: IconHome },
  { href: ROUTES.FARMERS, label: "Farmers", icon: IconUser },
  { href: ROUTES.FARMS, label: "Farms", icon: IconBuilding },
  { href: ROUTES.VISITS, label: "Visits", icon: IconClipboardList, roles: ROLES_CAN_LIST_VISITS },
  { href: ROUTES.SCHEDULES, label: "Schedules", icon: IconCalendar, roles: ROLES_SCHEDULES_PAGE },
  { href: ROUTES.STAFF, label: "Staff", icon: IconUsers, roles: ROLES_STAFF_PAGE },
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
