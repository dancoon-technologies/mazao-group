/**
 * Timestamp sync: compute device clock offset from server so the backend can store
 * server-corrected timestamps for accurate route ordering.
 * Offset = (device time - server time) in seconds. Refreshed when online (sync or tracking start).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '@/constants/config';

const OFFSET_STORAGE_KEY = 'mazao_device_clock_offset_seconds';

let cachedOffset: number | null = null;

/**
 * Fetch server UTC from API and compute offset (device - server) in seconds.
 * Call when online (e.g. at sync time or when tracking starts). Requires valid access token.
 */
export async function refreshDeviceClockOffset(accessToken: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/tracking/time/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { utc?: string };
    const serverIso = data?.utc;
    if (typeof serverIso !== 'string') return;
    const serverMs = new Date(serverIso).getTime();
    if (!Number.isFinite(serverMs)) return;
    const deviceMs = Date.now();
    const offsetSeconds = (deviceMs - serverMs) / 1000;
    cachedOffset = offsetSeconds;
    await AsyncStorage.setItem(OFFSET_STORAGE_KEY, String(offsetSeconds));
  } catch {
    // Offline or network error: keep previous cached offset if any
  }
}

/**
 * Return current device clock offset (seconds) for inclusion in location reports.
 * Uses in-memory cache first, then persisted value. Returns null if never refreshed.
 */
export async function getDeviceClockOffsetSeconds(): Promise<number | null> {
  if (cachedOffset !== null) return cachedOffset;
  try {
    const stored = await AsyncStorage.getItem(OFFSET_STORAGE_KEY);
    if (stored != null) {
      const n = parseFloat(stored);
      if (Number.isFinite(n)) {
        cachedOffset = n;
        return n;
      }
    }
  } catch {
    // ignore
  }
  return null;
}
