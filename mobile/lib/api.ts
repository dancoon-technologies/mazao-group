import * as SecureStore from 'expo-secure-store';
import { API_BASE, STORAGE_KEYS } from '@/constants/config';

export interface Farmer {
  id: string;
  title?: string;
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
  scheduled_date: string; // YYYY-MM-DD
  notes: string;
  status: 'proposed' | 'accepted' | 'rejected';
  approved_by?: string | null;
  created_at?: string;
}

export interface Visit {
  id: string;
  officer: string;
  officer_email?: string;
  farmer: string;
  farmer_display_name?: string;
  farm: string | null;
  farm_display_name?: string | null;
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
}

export interface LocationData {
  regions: { id: number; name: string }[];
  counties: { id: number; region_id: number; name: string }[];
  sub_counties: { id: number; county_id: number; name: string }[];
}

export interface DashboardStats {
  visits_today: number;
  visits_this_month: number;
  active_officers: number;
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

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await getRefreshToken();
  if (!refresh) return null;
  const res = await fetch(`${API_BASE}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    await clearTokens();
    return null;
  }
  const data = await res.json();
  await setTokens(data.access, data.refresh ?? refresh);
  return data.access;
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
    const newAccess = await refreshAccessToken();
    if (!newAccess) throw new Error('Session expired');
    res = await execute(newAccess);
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    const msg =
      error.detail ||
      (typeof error === 'object' && error !== null && Array.isArray(error.photo) ? error.photo[0] : null) ||
      (error.farmer_id?.[0]) ||
      (error.farm_id?.[0]) ||
      'Request failed';
    throw new Error(typeof msg === 'string' ? msg : 'Request failed');
  }
  return res.json();
}

// --- API ---

export const api = {
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'Login failed');
    await setTokens(data.access, data.refresh);
    return data;
  },

  logout: clearTokens,

  getFarmers: () => request<Farmer[]>('/farmers/'),

  async createFarmer(body: {
    title?: string;
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

  getFarms: (farmerId?: string) =>
    request<Farm[]>(farmerId ? `/farms/?farmer=${farmerId}` : '/farms/'),

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
  }) {
    return request<Farm>('/farms/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getLocations: () => request<LocationData>('/locations/'),

  getSchedules: () => request<Schedule[]>('/schedules/'),

  async createSchedule(body: {
    farmer?: string | null;
    scheduled_date: string; // YYYY-MM-DD
    notes?: string;
  }) {
    return request<Schedule>('/schedules/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getVisits: (params?: { officer?: string; date?: string }) => {
    const q = new URLSearchParams();
    if (params?.officer) q.set('officer', params.officer);
    if (params?.date) q.set('date', params.date);
    const query = q.toString();
    return request<Visit[]>(`/visits/${query ? `?${query}` : ''}`);
  },

  async createVisit(params: {
    farmer_id: string;
    farm_id?: string | null;
    latitude: number;
    longitude: number;
    notes?: string;
    photo: { uri: string; type?: string; name?: string };
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
    form.append('latitude', String(params.latitude));
    form.append('longitude', String(params.longitude));
    if (params.notes) form.append('notes', params.notes);
    form.append('photo', {
      uri: params.photo.uri,
      type: params.photo.type ?? 'image/jpeg',
      name: params.photo.name ?? 'photo.jpg',
    } as unknown as Blob);
    form.append('activity_type', params.activity_type ?? 'farm_to_farm_visits');
    if (params.crop_stage) form.append('crop_stage', params.crop_stage);
    if (params.germination_percent != null) form.append('germination_percent', String(params.germination_percent));
    if (params.survival_rate) form.append('survival_rate', params.survival_rate);
    if (params.pests_diseases) form.append('pests_diseases', params.pests_diseases);
    if (params.order_value != null) form.append('order_value', String(params.order_value));
    if (params.harvest_kgs != null) form.append('harvest_kgs', String(params.harvest_kgs));
    if (params.farmers_feedback) form.append('farmers_feedback', params.farmers_feedback);

    const res = await fetch(`${API_BASE}/visits/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}` },
      body: form,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data.detail ||
        data.photo?.[0] ||
        data.farmer_id?.[0] ||
        data.farm_id?.[0] ||
        'Failed to submit visit';
      throw new Error(msg);
    }
    return data as Visit;
  },

  getDashboardStats: () => request<DashboardStats>('/dashboard/stats/'),
};
