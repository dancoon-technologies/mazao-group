import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'DEVICE_ID';

/**
 * Returns a stable app-scoped device identifier.
 * Persisted in SecureStore so it survives app restarts.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing && existing.trim().length > 0) return existing.trim();
  const next = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, next);
  return next;
}
