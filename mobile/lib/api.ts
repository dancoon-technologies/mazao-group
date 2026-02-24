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

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let access = await getAccessToken();

  const execute = async (token?: string) => {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  };

  let res = await execute(access ?? undefined);

  // If token expired → refresh once
  if (res.status === 401) {
    const newAccess = await refreshAccessToken();
    if (!newAccess) throw new Error('Session expired');
    res = await execute(newAccess);
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || 'Request failed');
  }

  return res.json();
}

export const api = {
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.detail || 'Login failed');
    }

    await setTokens(data.access, data.refresh);
    return data;
  },

  logout: clearTokens,

  getFarmers: () => request<Farmer[]>('/farmers/'),

  getSchedules: () => request<Schedule[]>('/schedules/'),

  async createVisit(params: {
    schedule_id: string;
    latitude: number;
    longitude: number;
    notes?: string;
    photo: { uri: string; type?: string; name?: string };
  }) {
    const access = await getAccessToken();
    if (!access) throw new Error('Not authenticated');

    const form = new FormData();
    form.append('schedule_id', params.schedule_id);
    form.append('latitude', String(params.latitude));
    form.append('longitude', String(params.longitude));
    if (params.notes) form.append('notes', params.notes);

    form.append('photo', {
      uri: params.photo.uri,
      type: params.photo.type ?? 'image/jpeg',
      name: params.photo.name ?? 'photo.jpg',
    } as any);

    const res = await fetch(`${API_BASE}/visits/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
      },
      body: form,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data.detail ||
          data.photo?.[0] ||
          'Failed to submit visit'
      );
    }

    return data;
  },
};
