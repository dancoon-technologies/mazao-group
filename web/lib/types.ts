export type UserRole = "admin" | "supervisor" | "officer";

export interface Farmer {
  id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  display_name: string;
  phone: string;
  latitude: string;
  longitude: string;
  crop_type: string;
  assigned_officer: string | null;
  created_at: string;
}

export interface Visit {
  id: string;
  officer: string;
  officer_email?: string;
  officer_display_name?: string;
  farmer: string;
  farmer_display_name?: string;
  farm: string | null;
  farm_display_name?: string | null;
  latitude: string;
  longitude: string;
  photo: string;
  notes: string;
  distance_from_farmer: number | null;
  verification_status: "pending" | "verified" | "rejected";
  activity_type: string;
  crop_stage?: string;
  germination_percent?: number | null;
  survival_rate?: string;
  pests_diseases?: string;
  order_value?: number | null;
  harvest_kgs?: number | null;
  farmers_feedback?: string;
  created_at: string;
}

export interface Farm {
  id: string;
  farmer: string;
  county: string;
  sub_county: string;
  village: string;
  latitude: string;
  longitude: string;
  plot_size: string;
  crop_type: string;
  created_at: string;
}

export interface DashboardStats {
  visits_today: number;
  visits_this_month: number;
  active_officers: number;
  /** Verified visit count (all time in scope). */
  visits_verified?: number;
  /** Rejected visit count (all time in scope). */
  visits_rejected?: number;
  /** Percentage of visits verified, or null if no visits. */
  verification_rate_pct?: number | null;
  /** Total farmers (admin only). */
  total_farmers?: number;
  /** Total farms (admin only). */
  total_farms?: number;
}

export interface DashboardVisitsByDayItem {
  date: string;
  count: number;
}

export interface DashboardStatsByDepartmentItem {
  department_slug: string;
  department_name: string;
  visits_today: number;
  visits_this_month: number;
  active_officers: number;
}

export interface DashboardVisitsByActivityItem {
  activity_type: string;
  count: number;
}

export interface DashboardTopOfficerItem {
  officer_id: string;
  officer_email: string;
  display_name: string;
  visits_count: number;
}

export interface DashboardSchedulesSummary {
  schedules_proposed_this_month: number;
  schedules_accepted_this_month: number;
  schedules_scheduled_today: number;
  visits_recorded_today: number;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface TokenPayload {
  email?: string;
  role?: UserRole;
  exp?: number;
}

export type ScheduleStatus = "proposed" | "accepted" | "rejected";

export interface Schedule {
  id: string;
  created_by: string;
  officer: string;
  officer_email: string;
  officer_display_name?: string;
  farmer: string | null;
  farmer_display_name: string | null;
  farm: string | null;
  farm_display_name: string | null;
  scheduled_date: string;
  notes: string;
  status: ScheduleStatus;
  approved_by: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

export interface LocationRegion {
  id: number;
  name: string;
}

export interface LocationCounty {
  id: number;
  region_id: number;
  name: string;
}

export interface LocationSubCounty {
  id: number;
  county_id: number;
  name: string;
}

export interface LocationsResponse {
  regions: LocationRegion[];
  counties: LocationCounty[];
  sub_counties: LocationSubCounty[];
}

export interface OptionItem {
  value: string;
  label: string;
}

export interface OptionsResponse {
  departments: OptionItem[];
  staff_roles: OptionItem[];
}

export interface StaffUser {
  id: string;
  email: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  display_name: string;
  phone: string;
  role: "supervisor" | "officer";
  department: string;
  region: string;
  region_id: number | null;
  county_id: number | null;
  sub_county_id: number | null;
  is_active: boolean;
}

/** Staff user with visit counts (from GET /api/staff/performance). */
export interface StaffPerformanceUser extends StaffUser {
  visits_today: number;
  visits_this_month: number;
  visits_total: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export interface LocationReport {
  id: number;
  user_id: string;
  user_email: string;
  user_display_name: string | null;
  reported_at: string;
  /** Server-corrected time when device_clock_offset was sent; used for route ordering. */
  reported_at_server?: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  battery_percent: number | null;
  device_info: Record<string, unknown>;
  /** Client-side integrity: mock_provider, rooted, speed_kmh, integrity_flags. */
  device_integrity?: Record<string, unknown> | null;
  /** Server-side fraud flag e.g. impossible_travel, mock_provider. */
  integrity_warning?: string | null;
  created_at: string;
}
