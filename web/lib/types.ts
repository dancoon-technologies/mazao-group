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
  farmer: string;
  farmer_display_name?: string;
  farm: string | null;
  farm_display_name?: string | null;
  latitude: string;
  longitude: string;
  photo: string;
  notes: string;
  distance_from_farmer: number | null;
  verification_status: "verified" | "rejected";
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
}

export interface DashboardVisitsByDayItem {
  date: string;
  count: number;
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
  farmer: string | null;
  farmer_display_name: string | null;
  farm: string | null;
  farm_display_name: string | null;
  scheduled_date: string;
  notes: string;
  status: ScheduleStatus;
  approved_by: string | null;
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

export interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
}
