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
  latitude?: string;
  longitude?: string;
  crop_type?: string;
  assigned_officer?: string | null;
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
  created_at?: string;
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
  schedule?: string | null;
  schedule_display?: string | null;
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

export interface ActivityFormFieldOption {
  key: string;
  label: string;
  required?: boolean;
}

export interface ActivityTypeOption {
  value: string;
  label: string;
  /** Optional: which fields to show in step 3 for this activity. Empty/undefined = show all. */
  form_fields?: ActivityFormFieldOption[];
}

export interface TrackingSettings {
  working_hour_start: number;
  working_hour_end: number;
  interval_minutes?: number;
}

export interface OptionsResponse {
  departments: { value: string; label: string }[];
  staff_roles: { value: string; label: string }[];
  visit_settings: VisitSettings;
  activity_types?: ActivityTypeOption[];
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
    const errMsg = getApiErrorMessage(error) || `Request failed (${res.status})`;
    logger.warn(`API ${path} ${res.status}: ${errMsg}`);
    throw new Error(errMsg);
  }
  return res.json();
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
    crop_type?: string;
    assigned_officer?: string | null;
  }) {
    return request<Farmer>('/farmers/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getFarms(farmerId?: string) {
    const data = await request<Farm[] | { results: Farm[] }>(
      farmerId ? `/farms/?farmer=${farmerId}` : '/farms/'
    );
    return ensureArray(data);
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
    crop_type?: string;
    device_latitude?: number;
    device_longitude?: number;
  }) {
    return request<Farm>('/farms/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getLocations: () => request<LocationData>('/locations/'),

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

  /** PATCH proposed schedule (allowed only if scheduled date is not within 1 day). Officers can edit own proposed only. */
  async updateSchedule(
    id: string,
    body: { scheduled_date?: string; farmer?: string | null; farm?: string | null; notes?: string }
  ) {
    const payload: Record<string, unknown> = {};
    if (body.scheduled_date != null) payload.scheduled_date = String(body.scheduled_date).trim();
    if (body.farmer !== undefined) payload.farmer = body.farmer;
    if (body.farm !== undefined) payload.farm = body.farm;
    if (body.notes !== undefined) payload.notes = body.notes?.trim() ?? '';
    return request<Schedule>(`/schedules/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getVisits: async (params?: { officer?: string; date?: string }) => {
    const q = new URLSearchParams();
    if (params?.officer) q.set('officer', params.officer);
    if (params?.date) q.set('date', params.date);
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
    latitude: number;
    longitude: number;
    notes?: string;
    photo: { uri: string; type?: string; name?: string };
    photo_taken_at?: string;
    photo_device_info?: string;
    photo_place_name?: string;
    activity_type?: string;
    crop_stage?: string;
    germination_percent?: number | null;
    survival_rate?: string;
    pests_diseases?: string;
    order_value?: number | null;
    harvest_kgs?: number | null;
    farmers_feedback?: string;
  }) {
    const access = await getAccessToken();
    if (!access) throw new Error('Not authenticated');

    const form = new FormData();
    form.append('farmer_id', params.farmer_id);
    if (params.farm_id) form.append('farm_id', params.farm_id);
    if (params.schedule_id) form.append('schedule_id', params.schedule_id);
    form.append('latitude', String(params.latitude));
    form.append('longitude', String(params.longitude));
    if (params.notes) form.append('notes', params.notes);
    form.append('photo', {
      uri: params.photo.uri,
      type: params.photo.type ?? 'image/jpeg',
      name: params.photo.name ?? 'photo.jpg',
    } as unknown as Blob);
    if (params.photo_taken_at) form.append('photo_taken_at', params.photo_taken_at);
    if (params.photo_device_info) form.append('photo_device_info', params.photo_device_info);
    if (params.photo_place_name) form.append('photo_place_name', params.photo_place_name);
    form.append('activity_type', params.activity_type ?? 'farm_to_farm_visits');
    if (params.crop_stage) form.append('crop_stage', params.crop_stage);
    if (params.germination_percent != null) form.append('germination_percent', String(params.germination_percent));
    if (params.survival_rate) form.append('survival_rate', params.survival_rate);
    if (params.pests_diseases) form.append('pests_diseases', params.pests_diseases);
    if (params.order_value != null) form.append('order_value', String(params.order_value));
    if (params.harvest_kgs != null) form.append('harvest_kgs', String(params.harvest_kgs));
    if (params.farmers_feedback) form.append('farmers_feedback', params.farmers_feedback);

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
      const msg =
        data.detail ||
        data.photo?.[0] ||
        data.farmer_id?.[0] ||
        data.farm_id?.[0] ||
        data.schedule_id?.[0] ||
        (typeof data === 'object' && data !== null
          ? (Object.values(data).flat().find((v) => typeof v === 'string') as string | undefined)
          : undefined) ||
        'Failed to submit visit';
      logger.warn(`Create visit failed ${res.status}: ${msg ?? 'Failed to submit visit'}`);
      throw new Error(msg ?? 'Failed to submit visit');
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

  async getFarmers(params?: { search?: string }) {
    const q = params?.search?.trim() ? `?search=${encodeURIComponent(params.search.trim())}` : '';
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
