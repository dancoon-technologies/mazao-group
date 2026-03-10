/**
 * Shared mappers from SQLite rows to API types for offline list/detail screens.
 */
import type { Farmer, Farm, Schedule, Visit } from '@/lib/api';
import type { FarmerRow, FarmRow, ScheduleRow, VisitRow } from '@/store/types';

export function farmerRowToFarmer(r: FarmerRow): Farmer {
  return {
    id: r.id,
    first_name: r.first_name,
    middle_name: r.middle_name ?? undefined,
    last_name: r.last_name,
    display_name: r.display_name ?? [r.first_name, r.last_name].filter(Boolean).join(' '),
    phone: r.phone ?? undefined,
    latitude: r.latitude ?? undefined,
    longitude: r.longitude ?? undefined,
    crop_type: r.crop_type ?? undefined,
    assigned_officer: r.assigned_officer ?? undefined,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
  };
}

export function farmRowToFarm(r: FarmRow): Farm {
  return {
    id: r.id,
    farmer: r.farmer_id,
    region_id: r.region_id ?? undefined,
    region: r.region ?? undefined,
    county_id: r.county_id ?? undefined,
    county: r.county ?? undefined,
    sub_county_id: r.sub_county_id ?? undefined,
    sub_county: r.sub_county ?? undefined,
    village: r.village,
    latitude: r.latitude,
    longitude: r.longitude,
    plot_size: r.plot_size ?? undefined,
    crop_type: r.crop_type ?? undefined,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
  };
}

export function scheduleRowToSchedule(r: ScheduleRow): Schedule {
  return {
    id: r.id,
    officer: r.officer,
    officer_email: '',
    farmer: r.farmer,
    farmer_display_name: r.farmer_display_name ?? null,
    farm: r.farm ?? null,
    farm_display_name: r.farm_display_name ?? null,
    scheduled_date: new Date(r.scheduled_date).toISOString().slice(0, 10),
    notes: r.notes ?? '',
    status: r.status as 'proposed' | 'accepted' | 'rejected',
  };
}

export function visitRowToVisit(r: VisitRow): Visit {
  return {
    id: r.id,
    officer: r.officer,
    farmer: r.farmer,
    farm: r.farm,
    farmer_display_name: undefined,
    farm_display_name: undefined,
    schedule: r.schedule_id ?? null,
    latitude: r.latitude,
    longitude: r.longitude,
    verification_status: r.verification_status ?? 'pending',
    activity_type: r.activity_type ?? 'farm_to_farm_visits',
    notes: r.notes ?? undefined,
    created_at: new Date(r.created_at).toISOString(),
  };
}
