import * as SecureStore from 'expo-secure-store';
import { API_BASE, STORAGE_KEYS } from '@/constants/config';

export interface Farmer {
  id: string;
  display_name: string;
  phone: string;
  crop_type: string;
  latitude: string;
  longitude: string;
}

export interface Schedule {
  id: string;
  scheduled_date: string;
  farmer_display_name: string | null;
  farmer: string | null;
  officer_email: string;
  notes: string;
}

async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
}

async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
}

async function setTokens(access: string, refresh: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, access);
  await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refresh);
}

async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let access = await getAccessToken();
  if (!access) {
    const refresh = await getRefreshToken();
    if (refresh) {
      const base = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
      const res = await fetch(`${base}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (res.ok) {
        const data = await res.json();
        access = data.access;
        if (access && data.refresh) await setTokens(access, data.refresh);
      }
    }
  }
  const headers = new Headers(options.headers);
  if (access) headers.set('Authorization', `Bearer ${access}`);
  return fetch(url, { ...options, headers });
}

export const api = {
  async login(email: string, password: string): Promise<{ access: string; refresh: string }> {
    const base = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
    const res = await fetch(`${base}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail as string) || 'Login failed');
    await setTokens(data.access, data.refresh);
    return { access: data.access, refresh: data.refresh };
  },

  async logout(): Promise<void> {
    await clearTokens();
  },

  async getFarmers(): Promise<Farmer[]> {
    const base = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
    const res = await authFetch(`${base}/farmers/`);
    if (!res.ok) throw new Error('Failed to fetch farmers');
    const list = await res.json();
    return list;
  },

  async getSchedules(): Promise<Schedule[]> {
    const base = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
    const res = await authFetch(`${base}/schedules/`);
    if (!res.ok) throw new Error('Failed to fetch schedules');
    const list = await res.json();
    return list;
  },

  async createVisit(params: {
    farmer_id: string;
    latitude: number;
    longitude: number;
    notes?: string;
    photo: { uri: string; type?: string; name?: string };
  }): Promise<unknown> {
    const access = await getAccessToken();
    if (!access) throw new Error('Not authenticated');

    const form = new FormData();
    form.append('farmer_id', params.farmer_id);
    form.append('latitude', String(params.latitude));
    form.append('longitude', String(params.longitude));
    if (params.notes) form.append('notes', params.notes);
    form.append('photo', {
      uri: params.photo.uri,
      type: params.photo.type ?? 'image/jpeg',
      name: params.photo.name ?? 'photo.jpg',
    } as unknown as Blob);

    const base = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;
    const res = await fetch(`${base}/visits/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}` },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.detail as string) || (data.photo?.[0] as string) || 'Failed to submit visit');
    return data;
  },
};
