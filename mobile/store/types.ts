/** Local row types (same shapes as former SQLite tables). */

export interface FarmerRow {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  display_name: string | null;
  phone: string | null;
  latitude: string | null;
  longitude: string | null;
  crop_type: string | null;
  assigned_officer: string | null;
  created_at: number;
}

export interface FarmRow {
  id: string;
  farmer_id: string;
  village: string;
  latitude: number;
  longitude: number;
  plot_size: string | null;
  crop_type: string | null;
  region_id: number | null;
  county_id: number | null;
  sub_county_id: number | null;
  region: string | null;
  county: string | null;
  sub_county: string | null;
  created_at: number;
}

export interface ScheduleRow {
  id: string;
  officer: string;
  farmer: string | null;
  farmer_display_name: string | null;
  farm: string | null;
  farm_display_name: string | null;
  scheduled_date: number;
  notes: string | null;
  status: string;
  created_by: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  updated_at: number;
  is_deleted: number;
}

export interface VisitRow {
  id: string;
  officer: string;
  farmer: string;
  farm: string | null;
  schedule_id: string | null;
  latitude: number;
  longitude: number;
  photo_uri: string | null;
  notes: string | null;
  activity_type: string | null;
  verification_status: string | null;
  created_at: number;
  updated_at: number;
  is_deleted: number;
}

export interface SyncQueueRow {
  id: string;
  operation: string;
  entity: string;
  payload: string;
  status: string;
  timestamp: number;
}
