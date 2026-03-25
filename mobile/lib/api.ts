import * as SecureStore from 'expo-secure-store';
import { API_BASE, STORAGE_KEYS } from '@/constants/config';
import { logger } from '@/lib/logger';

export interface Farmer {
  id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  display_name: string;
  phone?: string;
  /** When true this record represents a stockist rather than a traditional farmer. */
  is_stockist?: boolean;
  latitude?: string;
  longitude?: string;
  created_at?: string;
}

export interface Farm {
  id: string;
  farmer: string;
  region_id?: number;
  region?: string;
  county_id?: number;
  county?: string;
  sub_county_id?: number;
  sub_county?: string;
  village: string;
  latitude: number;
  longitude: number;
  plot_size?: string;
  crop_type?: string;
  /** When true this location is an outlet/shop rather than a traditional farm. */
  is_outlet?: boolean;
  created_at?: string;
}

export interface Schedule {
  id: string;
  created_by?: string;
  officer: string;
  officer_email: string;
  farmer: string | null;
  farmer_display_name: string | null;
  farm: string | null;
  farm_display_name: string | null;
  scheduled_date: string; // YYYY-MM-DD
  notes: string;
  status: 'proposed' | 'accepted' | 'rejected';
  approved_by?: string | null;
  rejection_reason?: string | null;
  /** Officer's reason when requesting a change (supervisor must re-approve). */
  edit_reason?: string | null;
  created_at?: string;
}

/** One stop on a route: farmer/stockist + optional farm. */
export interface RouteStop {
  id: string;
  farmer: string;
  farmer_display_name: string;
  farm: string | null;
  farm_display_name: string | null;
  order: number;
}

/** Route = day plan: many stops (farmers/locations), same officer and activities. */
export interface Route {
  id: string;
  officer: string;
  officer_email?: string;
  officer_display_name?: string;
  scheduled_date: string; // YYYY-MM-DD
  name: string;
  activity_types: string[];
  notes: string;
  stops: RouteStop[];
  created_at?: string;
  updated_at?: string;
}

/** End-of-day report for a route (filled after 6 PM reminder). */
export interface RouteReport {
  id: string;
  route_id: string;
  report_data: Record<string, unknown>;
  submitted_at: string | null;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Visit {
  id: string;
  officer: string;
  officer_email?: string;
  officer_display_name?: string;
  farmer: string;
  /** True when the visit partner (farmer) is a stockist. From API; offline may infer. */
  partner_is_stockist?: boolean | null;
  farmer_display_name?: string;
  farm: string | null;
  farm_display_name?: string | null;
  schedule?: string | null;
  schedule_display?: string | null;
  route?: string | null;
  route_display?: string | null;
  latitude: number;
  longitude: number;
  photo?: string;
  notes?: string;
  distance_from_farmer?: number;
  verification_status: string;
  activity_type: string;
  crop_stage?: string;
  germination_percent?: number | null;
  survival_rate?: string;
  pests_diseases?: string;
  order_value?: number | null;
  harvest_kgs?: number | null;
  farmers_feedback?: string;
  created_at: string;
  updated_at?: string;
  photo_taken_at?: string | null;
  photo_device_info?: string | null;
  photo_place_name?: string | null;
  activity_types?: string[];
  photos?: string[];
  product_lines?: { product_id: string; product_name: string; product_code?: string; product_unit?: string; quantity_sold: string }[];
  number_of_stockists_visited?: number | null;
  merchandising?: string;
  counter_training?: string;
}

export interface LocationData {
  regions: { id: number; name: string }[];
  counties: { id: number; region_id: number; name: string }[];
  sub_counties: { id: number; county_id: number; name: string }[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  /** Deep-link payload from backend (same as Expo push `data`). */
  action_data?: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

export interface DashboardStats {
  visits_today: number;
  visits_this_month: number;
  active_officers: number;
}

/** Staff user (officer) for schedule assignment. From GET /api/officers/. */
export interface Officer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  role: string;
}

export interface VisitSettings {
  max_distance_meters: number;
  warning_distance_meters: number;
}

/** Configurable labels (e.g. Farmer/Farm vs Stockist/Outlet). From GET /api/options/ labels. */
export interface PartnerLocationLabels {
  partner: string;
  location: string;
}

export const DEFAULT_LABELS: PartnerLocationLabels = { partner: 'Farmer', location: 'Farm' };

/** Get partner/location labels from options response; fallback to Farmer/Farm. */
export function getLabels(options: OptionsResponse | null | undefined): PartnerLocationLabels {
  if (options?.labels?.partner != null && options?.labels?.location != null) {
    return { partner: options.labels.partner, location: options.labels.location };
  }
  return DEFAULT_LABELS;
}

export interface ActivityFormFieldOption {
  key: string;
  label: string;
  required?: boolean;
}

export interface ActivityTypeOption {
  value: string;
  label: string;
  /** When false, hide from "Select activities" modal. Omitted or true = show. */
  is_active?: boolean;
  /** Optional: which fields to show in step 3 for this activity. Empty/undefined = show all. */
  form_fields?: ActivityFormFieldOption[];
}

export interface TrackingSettings {
  working_hour_start: number;
  working_hour_end: number;
  interval_minutes?: number;
}

export interface LocationReport {
  id: string;
  user_id: string | null;
  user_email: string;
  user_display_name: string | null;
  reported_at: string;
  reported_at_server?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  battery_percent: number | null;
  device_info: Record<string, unknown>;
  device_integrity?: Record<string, unknown> | null;
  integrity_warning?: string | null;
  created_at: string;
}

export interface ProductOption {
  id: string;
  name: string;
  code: string;
  unit: string;
}

/** Schema for one step-3 field: how to render (input_type) and how to send (value_type, api_key). From backend options. */
export interface VisitFormFieldSchemaItem {
  input_type: 'text' | 'number' | 'integer' | 'multiline' | 'product';
  value_type: 'string' | 'number' | 'integer';
  api_key?: string;
}

export interface OptionsResponse {
  departments: { value: string; label: string }[];
  staff_roles: { value: string; label: string }[];
  visit_settings: VisitSettings;
  /** Partner/location terminology (e.g. Farmer/Farm or Stockist/Outlet). */
  labels?: PartnerLocationLabels;
  activity_types?: ActivityTypeOption[];
  /** Products for the user's department (for recording sales during visits). */
  products?: ProductOption[];
  /** Step-3 fields: key -> input_type, value_type, api_key. Single source of truth from backend. */
  visit_form_field_schema?: Record<string, VisitFormFieldSchemaItem>;
  /** Default step-3 fields when activity has no form_fields. From backend. */
  default_visit_form_fields?: ActivityFormFieldOption[];
  tracking_settings?: TrackingSettings;
}

// --- Helpers ---

/** Normalize API list responses (array or paginated { results }) to always return an array. */
function ensureArray<T>(data: T[] | { results?: T[] } | undefined | null): T[] {
  if (Array.isArray(data)) return data;
  if (data != null && typeof data === 'object' && Array.isArray((data as { results?: T[] }).results))
    return (data as { results: T[] }).results;
  return [];
}

// --- Token helpers ---

const getAccessToken = () =>
  SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);

const getRefreshToken = () =>
  SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);

const setTokens = async (access: string, refresh: string) => {
  await Promise.all([
    SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, access),
    SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refresh),
  ]);
};

const clearTokens = async () => {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
  ]);
};

/** Called when tokens are cleared due to refresh failure (e.g. logged in on another device). AuthContext registers to show login. */
let onSessionInvalidated: (() => void) | null = null;
export function setOnSessionInvalidated(callback: (() => void) | null) {
  onSessionInvalidated = callback;
}

/** Result of refresh: access token or null; if session ended due to login elsewhere, sessionError is set. */
async function refreshAccessToken(): Promise<{ access: string | null; sessionError?: string }> {
  const refresh = await getRefreshToken();
  if (!refresh) return { access: null };
  const res = await fetch(`${API_BASE}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const detail = (errBody as { detail?: string | string[] }).detail;
    const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail[0] : undefined;
    const loggedInElsewhere =
      typeof message === 'string' &&
      (message.toLowerCase().includes('another device') || message.toLowerCase().includes('logged in on another'));
    logger.warn('Token refresh failed, clearing tokens', loggedInElsewhere ? '(logged in elsewhere)' : '');
    await clearTokens();
    onSessionInvalidated?.();
    return { access: null, sessionError: message || 'Session expired' };
  }
  const data = await res.json();
  await setTokens(data.access, data.refresh ?? refresh);
  logger.debug('Token refresh success');
  return { access: data.access };
}

/** Human-readable labels for DRF field keys (nested errors, routes, visits, etc.). */
const DRF_FIELD_LABELS: Record<string, string> = {
  officer: 'Officer',
  scheduled_date: 'Route date',
  name: 'Route name',
  activity_types: 'Activity types',
  notes: 'Notes',
  stops: 'Stops',
  farmer_id: 'Customer',
  farm_id: 'Farm or outlet',
  order: 'Stop order',
  non_field_errors: 'Error',
  detail: 'Error',
};

/**
 * Flatten DRF validation errors (including nested `stops: [{ farmer_id: [...] }]`) into readable sentences.
 */
function formatDrfValidationErrors(error: unknown): string | null {
  if (error == null || typeof error !== 'object' || Array.isArray(error)) return null;
  const o = error as Record<string, unknown>;
  if (typeof o.detail === 'string') return o.detail;
  if (Array.isArray(o.detail) && typeof o.detail[0] === 'string') return o.detail.join(' ');

  const parts: string[] = [];

  function label(key: string): string {
    return DRF_FIELD_LABELS[key] ?? key.replace(/_/g, ' ');
  }

  function appendMessages(prefix: string, msgs: unknown): void {
    if (!Array.isArray(msgs)) return;
    for (const m of msgs) {
      if (typeof m === 'string' && m.trim()) {
        parts.push(prefix ? `${prefix}: ${m}` : m);
      }
    }
  }

  function walk(prefix: string, key: string, value: unknown): void {
    const base = prefix ? `${prefix} — ${label(key)}` : label(key);
    if (value == null) return;
    if (typeof value === 'string') {
      parts.push(prefix ? `${prefix}: ${value}` : value);
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      if (typeof value[0] === 'string') {
        appendMessages(base, value);
        return;
      }
      if (typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0])) {
        value.forEach((item, i) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            const stopPrefix = key === 'stops' ? `Stop ${i + 1}` : `${label(key)} ${i + 1}`;
            for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
              walk(stopPrefix, k, v);
            }
          }
        });
        return;
      }
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(base, k, v);
      }
    }
  }

  for (const [key, value] of Object.entries(o)) {
    if (key === 'detail') continue;
    walk('', key, value);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

/** Extract first user-facing message from DRF-style error body (detail, or any key with string[]). */
function getApiErrorMessage(error: unknown): string | null {
  if (error == null || typeof error !== 'object') return null;
  const o = error as Record<string, unknown>;
  if (o.detail != null) {
    if (typeof o.detail === 'string') return o.detail;
    if (Array.isArray(o.detail) && typeof o.detail[0] === 'string') return o.detail[0];
  }
  for (const key of ['officer', 'farmer', 'scheduled_date', 'photo', 'farmer_id', 'farm_id'] as const) {
    const v = o[key];
    if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  }
  for (const v of Object.values(o)) {
    const s = Array.isArray(v) ? v.find((x) => typeof x === 'string') : typeof v === 'string' ? v : undefined;
    if (typeof s === 'string') return s;
  }
  return null;
}

// --- JSON request helper (with refresh) ---

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let access = await getAccessToken();
  const execute = async (token?: string) => {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${API_BASE}${path}`, { ...options, headers });
  };
  let res = await execute(access ?? undefined);
  if (res.status === 401) {
    logger.debug(`Request ${path} returned 401, attempting token refresh`);
    const { access: newAccess, sessionError } = await refreshAccessToken();
    if (!newAccess) {
      throw new Error(sessionError || 'Session expired');
    }
    res = await execute(newAccess);
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const errMsg =
      (res.status === 400 ? formatDrfValidationErrors(error) : null) ||
      getApiErrorMessage(error) ||
      `Request failed (${res.status})`;
    logger.warn(`API ${path} ${res.status}: ${errMsg}`);
    throw new Error(errMsg);
  }
  return res.json();
}

/** Build a readable validation error from visit create 400 response (serializer.errors style). */
function formatVisitValidationError(data: unknown): string {
  if (data != null && typeof data === 'object' && 'detail' in data && typeof (data as { detail: unknown }).detail === 'string') {
    return (data as { detail: string }).detail;
  }
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const fieldLabels: Record<string, string> = {
      photo: 'Photo',
      farmer_id: 'Farmer',
      farm_id: 'Farm',
      schedule_id: 'Schedule',
      latitude: 'Latitude',
      longitude: 'Longitude',
      crop_stage: 'Crop stage',
      germination_percent: 'Germination %',
      survival_rate: 'Survival rate',
      pests_diseases: 'Pests/diseases',
      order_value: 'Order value',
      harvest_kgs: 'Harvest (kg)',
      farmers_feedback: 'Feedback',
      number_of_stockists_visited: 'Number of stockists visited',
      merchandising: 'Merchandising',
      counter_training: 'Counter training',
      product_lines: 'Products',
      travel_validation: 'Travel',
    };
    const parts: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const msg = Array.isArray(value) ? (value.find((v) => typeof v === 'string') as string | undefined) : typeof value === 'string' ? value : undefined;
      if (msg) {
        const label = fieldLabels[key] ?? key.replace(/_/g, ' ');
        parts.push(`${label}: ${msg}`);
      }
    }
    if (parts.length > 0) return parts.join('. ');
  }
  return 'Failed to submit visit';
}

// --- API ---

export const api = {
  async login(email: string, password: string) {
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    try {
      const res = await fetch(`${API_BASE}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        logger.warn(`Login failed for email=${normalizedEmail}: ${data.detail || res.status}`);
        throw new Error(data.detail || 'Login failed');
      }
      await setTokens(data.access, data.refresh);
      logger.info(`Login success email=${normalizedEmail}`);
      return data;
    } catch (e) {
      const isAbort = e instanceof Error && (e.name === 'AbortError' || e.message === 'The user aborted a request.');
      if (isAbort) {
        throw new Error('Request was cancelled. Please try again.');
      }
      throw e;
    }
  },

  async changePassword(current_password: string, new_password: string) {
    const access = await getAccessToken();
    if (!access) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE}/auth/change-password/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access}`,
      },
      body: JSON.stringify({ current_password, new_password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.current_password?.[0] || data.detail || 'Failed to change password');
    if (data.access && data.refresh) await setTokens(data.access, data.refresh);
  },

  logout: clearTokens,

  async createFarmer(body: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    phone?: string;
    latitude?: number;
    longitude?: number;
    is_stockist?: boolean;
  }) {
    return request<Farmer>('/farmers/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** Fetch farms (optionally for one farmer, optionally filter by is_outlet). Fetches all pages when response is paginated. */
  async getFarms(farmerId?: string, opts?: { is_outlet?: boolean }) {
    const params = new URLSearchParams();
    if (farmerId) params.set('farmer', farmerId);
    if (opts?.is_outlet !== undefined) params.set('is_outlet', String(opts.is_outlet));
    const base = params.toString() ? `/farms/?${params.toString()}` : '/farms/';
    const all: Farm[] = [];
    let page = 1;
    type PageResponse = { results?: Farm[]; next?: string | null };
    while (true) {
      const url = base + (base.includes('?') ? '&' : '?') + `page=${page}`;
      const data = await request<Farm[] | PageResponse>(url);
      const batch = ensureArray(Array.isArray(data) ? data : (data as PageResponse).results);
      all.push(...batch);
      const hasNext = !Array.isArray(data) && data != null && typeof data === 'object' && (data as PageResponse).next;
      if (!hasNext || batch.length === 0) break;
      page += 1;
    }
    return all;
  },

  async createFarm(body: {
    farmer_id: string;
    region_id: number;
    county_id: number;
    sub_county_id: number;
    village: string;
    latitude: number;
    longitude: number;
    plot_size?: string;
    is_outlet?: boolean;
    device_latitude?: number;
    device_longitude?: number;
  }) {
    return request<Farm>('/farms/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getLocations: () => request<LocationData>('/locations/'),

  /** Location reports list for admin/supervisor. Backend scopes supervisor to their department. */
  async getTrackingReports(params?: {
    user_id?: string;
    date?: string; // YYYY-MM-DD
    date_from?: string; // YYYY-MM-DD
    date_to?: string; // YYYY-MM-DD
    page_size?: number;
  }) {
    const q = new URLSearchParams();
    if (params?.user_id) q.set('user_id', params.user_id);
    if (params?.date) q.set('date', params.date);
    if (params?.date_from) q.set('date_from', params.date_from);
    if (params?.date_to) q.set('date_to', params.date_to);
    if (params?.page_size != null) q.set('page_size', String(params.page_size));
    const query = q.toString();
    const path = query ? `/tracking/reports/?${query}` : '/tracking/reports/';
    const data = await request<LocationReport[] | { results?: LocationReport[] }>(path);
    const list = Array.isArray(data) ? data : (data?.results ?? []);
    return list;
  },

  /** Routes (weekly plan). Optional week_start=YYYY-MM-DD for Mon–Sat of that week. First page only unless you use getAllRoutes. */
  async getRoutes(params?: { week_start?: string; officer?: string }) {
    const q = new URLSearchParams();
    if (params?.week_start) q.set('week_start', params.week_start);
    if (params?.officer) q.set('officer', params.officer);
    const query = q.toString();
    const path = query ? `/routes/?${query}` : '/routes/';
    const data = await request<Route[] | { results: Route[] }>(path);
    return ensureArray(data);
  },

  async getRoute(id: string) {
    return request<Route>(`/routes/${id}/`);
  },

  /** All routes visible to the user (follows pagination until exhausted). */
  async getAllRoutes(params?: { week_start?: string; officer?: string }) {
    const all: Route[] = [];
    let page = 1;
    type PageResponse = { results?: Route[]; next?: string | null };
    while (true) {
      const q = new URLSearchParams();
      q.set('page', String(page));
      if (params?.week_start) q.set('week_start', params.week_start);
      if (params?.officer) q.set('officer', params.officer);
      const data = await request<Route[] | PageResponse>(`/routes/?${q.toString()}`);
      const batch = ensureArray(Array.isArray(data) ? data : (data as PageResponse).results);
      all.push(...batch);
      const hasNext =
        !Array.isArray(data) && data != null && typeof data === 'object' && Boolean((data as PageResponse).next);
      if (!hasNext || batch.length === 0) break;
      page += 1;
    }
    return all;
  },

  async createRoute(body: {
    scheduled_date: string;
    /** When admin/supervisor plans for another officer (weekly routes). */
    officer?: string | null;
    name?: string;
    activity_types?: string[];
    notes?: string;
    stops?: { farmer_id: string; farm_id?: string | null; order?: number }[];
  }) {
    const payload: Record<string, unknown> = {
      scheduled_date: String(body.scheduled_date).trim(),
      name: body.name?.trim() ?? '',
      activity_types: body.activity_types ?? [],
      notes: body.notes?.trim() ?? '',
      stops: (body.stops ?? []).map((s, i) => ({
        farmer_id: s.farmer_id,
        farm_id: s.farm_id ?? null,
        order: s.order ?? i,
      })),
    };
    if (body.officer != null && body.officer !== '') {
      payload.officer = body.officer;
    }
    return request<Route>('/routes/', { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateRoute(
    id: string,
    body: {
      scheduled_date?: string;
      name?: string;
      activity_types?: string[];
      notes?: string;
      stops?: { farmer_id: string; farm_id?: string | null; order?: number }[];
    }
  ) {
    const payload: Record<string, unknown> = {};
    if (body.scheduled_date != null) payload.scheduled_date = String(body.scheduled_date).trim();
    if (body.name !== undefined) payload.name = body.name?.trim() ?? '';
    if (body.activity_types !== undefined) payload.activity_types = body.activity_types;
    if (body.notes !== undefined) payload.notes = body.notes?.trim() ?? '';
    if (body.stops !== undefined) {
      payload.stops = body.stops.map((s, i) => ({
        farmer_id: s.farmer_id,
        farm_id: s.farm_id ?? null,
        order: s.order ?? i,
      }));
    }
    return request<Route>(`/routes/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteRoute(id: string) {
    await request(`/routes/${id}/`, { method: 'DELETE' });
  },

  async getRouteReport(routeId: string) {
    return request<RouteReport>(`/routes/${routeId}/report/`);
  },

  async submitRouteReport(routeId: string, reportData: Record<string, unknown>) {
    return request<RouteReport>(`/routes/${routeId}/report/`, {
      method: 'PATCH',
      body: JSON.stringify({ report_data: reportData }),
    });
  },

  /** Fetches all schedules (all pages) so supervisor-assigned schedules are included. */
  async getSchedules() {
    const all: Schedule[] = [];
    let page = 1;
    type PageResponse = { results?: Schedule[]; next?: string | null };
    while (true) {
      const data = await request<Schedule[] | PageResponse>(`/schedules/?page=${page}`);
      const batch = ensureArray(Array.isArray(data) ? data : (data as PageResponse).results);
      all.push(...batch);
      const hasNext = !Array.isArray(data) && data != null && typeof data === 'object' && (data as PageResponse).next;
      if (!hasNext || batch.length === 0) break;
      page += 1;
    }
    return all;
  },

  async getOfficers() {
    const data = await request<Officer[] | { results: Officer[] }>('/officers/');
    return ensureArray(data);
  },

  async createSchedule(body: {
    officer?: string | null;
    farmer?: string | null;
    farm?: string | null;
    scheduled_date: string; // YYYY-MM-DD
    notes?: string;
  }) {
    const payload: Record<string, unknown> = {
      scheduled_date: String(body.scheduled_date).trim(),
      notes: body.notes?.trim() ?? '',
      farmer: body.farmer ?? null,
      farm: body.farm ?? null,
    };
    if (body.officer != null && body.officer !== '') payload.officer = body.officer;
    return request<Schedule>('/schedules/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** PATCH proposed schedule (allowed only if scheduled date is not in the past). Officers can edit own proposed only. */
  async updateSchedule(
    id: string,
    body: { scheduled_date?: string; farmer?: string | null; farm?: string | null; notes?: string; edit_reason?: string }
  ) {
    const payload: Record<string, unknown> = {};
    if (body.scheduled_date != null) payload.scheduled_date = String(body.scheduled_date).trim();
    if (body.farmer !== undefined) payload.farmer = body.farmer;
    if (body.farm !== undefined) payload.farm = body.farm;
    if (body.notes !== undefined) payload.notes = body.notes?.trim() ?? '';
    if (body.edit_reason !== undefined) payload.edit_reason = String(body.edit_reason).trim();
    return request<Schedule>(`/schedules/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getVisits: async (params?: { officer?: string; date?: string; date_from?: string; date_to?: string; farm?: string; route?: string }) => {
    const q = new URLSearchParams();
    if (params?.officer) q.set('officer', params.officer);
    if (params?.date) q.set('date', params.date);
    if (params?.date_from) q.set('date_from', params.date_from);
    if (params?.date_to) q.set('date_to', params.date_to);
    if (params?.farm) q.set('farm', params.farm);
    if (params?.route) q.set('route', params.route);
    const query = q.toString();
    const path = query ? `/visits/?${query}` : '/visits/';
    const data = await request<Visit[] | { results: Visit[] }>(path);
    return Array.isArray(data) ? data : (data?.results ?? []);
  },

  /** Get a single visit by id (for visit detail screen). */
  async getVisit(id: string) {
    return request<Visit>(`/visits/${id}/`);
  },

  async createVisit(params: {
    farmer_id: string;
    farm_id?: string | null;
    schedule_id?: string | null;
    route_id?: string | null;
    latitude: number;
    longitude: number;
    notes?: string;
    /** One or more photos (all appended as FormData "photo"). */
    photos: { uri: string; type?: string; name?: string }[];
    photo_taken_at?: string;
    photo_device_info?: string;
    photo_place_name?: string;
    activity_type?: string;
    activity_types?: string[];
    crop_stage?: string;
    germination_percent?: number | null;
    survival_rate?: string;
    pests_diseases?: string;
    order_value?: number | null;
    harvest_kgs?: number | null;
    farmers_feedback?: string;
    product_lines?: { product_id: string; quantity_sold?: number }[];
    number_of_stockists_visited?: number | null;
    merchandising?: string;
    counter_training?: string;
  }) {
    const access = await getAccessToken();
    if (!access) throw new Error('Not authenticated');

    const form = new FormData();
    form.append('farmer_id', params.farmer_id);
    if (params.farm_id) form.append('farm_id', params.farm_id);
    if (params.schedule_id) form.append('schedule_id', params.schedule_id);
    if (params.route_id) form.append('route_id', params.route_id);
    form.append('latitude', String(params.latitude));
    form.append('longitude', String(params.longitude));
    if (params.notes) form.append('notes', params.notes);
    for (const p of params.photos) {
      form.append('photo', {
        uri: p.uri,
        type: p.type ?? 'image/jpeg',
        name: p.name ?? 'photo.jpg',
      } as unknown as Blob);
    }
    if (params.photo_taken_at) form.append('photo_taken_at', params.photo_taken_at);
    if (params.photo_device_info) form.append('photo_device_info', params.photo_device_info);
    if (params.photo_place_name) form.append('photo_place_name', params.photo_place_name);
    if (params.activity_types?.length) {
      for (const v of params.activity_types) form.append('activity_types', v);
    }
    form.append('activity_type', params.activity_type ?? params.activity_types?.[0] ?? 'farm_to_farm_visits');
    if (params.crop_stage) form.append('crop_stage', params.crop_stage);
    if (params.germination_percent != null) form.append('germination_percent', String(params.germination_percent));
    if (params.survival_rate) form.append('survival_rate', params.survival_rate);
    if (params.pests_diseases) form.append('pests_diseases', params.pests_diseases);
    if (params.order_value != null) form.append('order_value', String(params.order_value));
    if (params.harvest_kgs != null) form.append('harvest_kgs', String(params.harvest_kgs));
    if (params.farmers_feedback) form.append('farmers_feedback', params.farmers_feedback);
    if (params.product_lines?.length) {
      form.append('product_lines', JSON.stringify(params.product_lines));
    }
    if (params.number_of_stockists_visited != null) form.append('number_of_stockists_visited', String(params.number_of_stockists_visited));
    if (params.merchandising) form.append('merchandising', params.merchandising);
    if (params.counter_training) form.append('counter_training', params.counter_training);

    let res = await fetch(`${API_BASE}/visits/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}` },
      body: form,
    });
    if (res.status === 401) {
      const { access: newAccess } = await refreshAccessToken();
      if (newAccess) {
        res = await fetch(`${API_BASE}/visits/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${newAccess}` },
          body: form,
        });
      }
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = formatVisitValidationError(data);
      logger.warn(`Create visit failed ${res.status}: ${msg}`);
      const err = new Error(msg) as Error & { isValidation?: boolean };
      err.isValidation = res.status >= 400 && res.status < 500;
      throw err;
    }
    logger.info(`Visit created id=${(data as Visit).id} farmer_id=${params.farmer_id}`);
    return data as Visit;
  },

  getDashboardStats: () => request<DashboardStats>('/dashboard/stats/'),

  /** Validate current session is still active. Returns true if valid, false if invalid or timeout (5s). */
  async validateSession(): Promise<boolean> {
    const access = await getAccessToken();
    if (!access) return false;
    const timeoutMs = 5000;
    try {
      await Promise.race([
        request<OptionsResponse>('/options/'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('validateSession timeout')), timeoutMs)
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  },

  /** Attempt to refresh the access token. Returns true if successful, false if refresh failed (session invalidated). */
  async refreshTokenIfNeeded(): Promise<boolean> {
    const { access } = await refreshAccessToken();
    return access !== null;
  },

  /** Get current access token (for checking expiration). */
  getAccessToken,

  /** Clear all tokens (for manual logout). */
  clearTokens,

  /** Options and app settings (activity_types filtered by user department). Requires auth. */
  async getOptions() {
    return request<OptionsResponse>('/options/');
  },

  async getFarmers(params?: { search?: string; is_stockist?: boolean }) {
    const searchParams = new URLSearchParams();
    if (params?.search?.trim()) searchParams.set('search', params.search.trim());
    if (params?.is_stockist !== undefined) searchParams.set('is_stockist', String(params.is_stockist));
    const q = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const data = await request<Farmer[] | { results: Farmer[] }>(`/farmers/${q}`);
    return ensureArray(data);
  },

  // Notifications (in-app + push token registration)
  async getNotifications() {
    const data = await request<Notification[] | { results: Notification[] }>('/notifications/');
    return ensureArray(data);
  },

  async getNotificationUnreadCount() {
    return request<{ unread_count: number }>('/notifications/unread-count/');
  },

  async markNotificationRead(id: string) {
    return request<Notification>(`/notifications/${id}/read/`, { method: 'PATCH' });
  },

  async markAllNotificationsRead() {
    return request<{ marked_count: number }>('/notifications/mark-all-read/', { method: 'POST' });
  },

  async archiveNotification(id: string) {
    await request(`/notifications/${id}/archive/`, { method: 'POST' });
  },

  async registerPushToken(expo_push_token: string, device_id?: string) {
    return request<{ status: string }>('/notifications/register-device/', {
      method: 'POST',
      body: JSON.stringify({ expo_push_token: expo_push_token, device_id: device_id ?? '' }),
    });
  },

  async getPushStatus() {
    return request<{ push_registered: boolean }>('/notifications/push-status/');
  },

  async sendTestPush() {
    return request<{ status: string; message?: string }>('/notifications/test-push/', { method: 'POST' });
  },
};
