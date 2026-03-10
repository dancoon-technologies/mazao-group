/** Normalize server API responses to local row shape. */

function isoToTimestamp(iso: string | null | undefined): number | null {
  if (iso == null) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function dateStringToTimestamp(dateStr: string | null | undefined): number {
  if (dateStr == null) return 0;
  const t = new Date(dateStr + 'T00:00:00Z').getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function normalizeServerVisit(record: Record<string, unknown>): Record<string, unknown> {
  const schedule = record.schedule ?? record.schedule_id ?? null;
  return {
    id: record.id,
    officer: record.officer != null ? String(record.officer) : '',
    farmer: record.farmer != null ? String(record.farmer) : '',
    farm: record.farm ?? null,
    schedule_id: schedule != null ? String(schedule) : null,
    latitude: Number(record.latitude) || 0,
    longitude: Number(record.longitude) || 0,
    photo_uri: record.photo ? String(record.photo) : null,
    notes: record.notes ?? null,
    activity_type: record.activity_type ?? null,
    verification_status: record.verification_status ?? null,
    created_at: isoToTimestamp(record.created_at as string) ?? Date.now(),
    updated_at: isoToTimestamp(record.updated_at as string) ?? Date.now(),
    is_deleted: Boolean(record.is_deleted) ? 1 : 0,
  };
}

export function normalizeServerSchedule(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    officer: record.officer != null ? String(record.officer) : '',
    farmer: record.farmer != null ? String(record.farmer) : null,
    farmer_display_name: record.farmer_display_name != null ? String(record.farmer_display_name) : null,
    farm: record.farm != null ? String(record.farm) : null,
    farm_display_name: record.farm_display_name ?? null,
    scheduled_date: dateStringToTimestamp(record.scheduled_date as string),
    notes: record.notes ?? null,
    status: record.status ?? 'proposed',
    created_by: record.created_by ?? null,
    approved_by: record.approved_by ?? null,
    updated_at: isoToTimestamp(record.updated_at as string) ?? Date.now(),
    is_deleted: Boolean(record.is_deleted) ? 1 : 0,
  };
}

export function normalizeServerFarmer(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    first_name: record.first_name ?? '',
    middle_name: record.middle_name ?? null,
    last_name: record.last_name ?? '',
    display_name: record.display_name ?? null,
    phone: record.phone ?? null,
    latitude: record.latitude != null ? String(record.latitude) : null,
    longitude: record.longitude != null ? String(record.longitude) : null,
    crop_type: record.crop_type ?? null,
    assigned_officer: record.assigned_officer ?? null,
    created_at: isoToTimestamp(record.created_at as string) ?? 0,
  };
}

export function normalizeServerFarm(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    farmer_id: record.farmer ?? '',
    village: record.village ?? '',
    latitude: Number(record.latitude) || 0,
    longitude: Number(record.longitude) || 0,
    plot_size: record.plot_size ?? null,
    crop_type: record.crop_type ?? null,
    region_id: record.region_id != null ? Number(record.region_id) : null,
    county_id: record.county_id != null ? Number(record.county_id) : null,
    sub_county_id: record.sub_county_id != null ? Number(record.sub_county_id) : null,
    region: record.region ?? null,
    county: record.county ?? null,
    sub_county: record.sub_county ?? null,
    created_at: isoToTimestamp(record.created_at as string) ?? 0,
  };
}
