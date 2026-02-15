export type UserRole = "admin" | "supervisor" | "officer";

export interface Farmer {
  id: string;
  title: string;
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
  farmer: string;
  latitude: string;
  longitude: string;
  photo: string;
  notes: string;
  distance_from_farmer: number | null;
  verification_status: "verified" | "rejected";
  created_at: string;
}

export interface DashboardStats {
  visits_today: number;
  visits_this_month: number;
  active_officers: number;
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

export interface Schedule {
  id: string;
  created_by: string;
  officer: string;
  officer_email: string;
  farmer: string | null;
  farmer_display_name: string | null;
  scheduled_date: string;
  notes: string;
  created_at: string;
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
  region: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
}
