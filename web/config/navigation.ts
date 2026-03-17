import type { UserRole } from "@/lib/types";
import {
  ROUTES,
  ROLES_SCHEDULES_PAGE,
  ROLES_STAFF_PAGE,
  ROLES_CAN_LIST_VISITS,
  ROLES_TRACKING,
} from "@/lib/constants";
import { IconHome, IconUser, IconBuilding, IconBuildingStore, IconClipboardList, IconCalendar, IconUsers, IconMapPin, IconShoppingCart } from "@tabler/icons-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof IconHome | typeof IconUser | typeof IconBuilding | typeof IconBuildingStore | typeof IconClipboardList | typeof IconCalendar | typeof IconUsers | typeof IconMapPin | typeof IconShoppingCart;
  roles?: readonly UserRole[];
}

export const APP_NAV: NavItem[] = [
  { href: ROUTES.DASHBOARD, label: "Dashboard", icon: IconHome },
  { href: ROUTES.FARMERS, label: "Farmers", icon: IconUser },
  { href: ROUTES.STOCKISTS, label: "Stockists", icon: IconBuildingStore },
  { href: ROUTES.FARMS, label: "Farms", icon: IconBuilding },
  { href: ROUTES.OUTLETS, label: "Outlets", icon: IconBuildingStore },
  { href: ROUTES.VISITS, label: "Visits", icon: IconClipboardList, roles: ROLES_CAN_LIST_VISITS },
  { href: ROUTES.SALES, label: "Sales", icon: IconShoppingCart, roles: ROLES_CAN_LIST_VISITS },
  { href: ROUTES.SCHEDULES, label: "Schedules", icon: IconCalendar, roles: ROLES_SCHEDULES_PAGE },
  { href: ROUTES.TRACKING, label: "Track team", icon: IconMapPin, roles: ROLES_TRACKING },
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
