/**
 * Offline login: store credentials (hashed) and cached auth payload after successful online login.
 * When offline, verify email + password against stored hash and restore session from cached payload.
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '@/constants/config';

export type CachedAuthPayload = {
  userId: string | null;
  email: string | null;
  displayName: string | null;
  role: string | null;
  roleDisplay: string | null;
  department: string | null;
  region: string | null;
  mustChangePassword: boolean;
};

const PAYLOAD_KEY = STORAGE_KEYS.CACHED_AUTH_PAYLOAD;
const EMAIL_KEY = STORAGE_KEYS.OFFLINE_EMAIL;
const HASH_KEY = STORAGE_KEYS.OFFLINE_PASSWORD_HASH;

export async function hashPassword(password: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

export async function saveOfflineCredentials(
  email: string,
  password: string,
  payload: CachedAuthPayload
): Promise<void> {
  const hash = await hashPassword(password);
  await Promise.all([
    SecureStore.setItemAsync(EMAIL_KEY, email.trim().toLowerCase()),
    SecureStore.setItemAsync(HASH_KEY, hash),
    SecureStore.setItemAsync(PAYLOAD_KEY, JSON.stringify(payload)),
  ]);
}

export async function clearOfflineCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(EMAIL_KEY),
    SecureStore.deleteItemAsync(HASH_KEY),
    SecureStore.deleteItemAsync(PAYLOAD_KEY),
  ]);
}

export async function getOfflineCredentials(): Promise<{
  email: string | null;
  passwordHash: string | null;
  payload: CachedAuthPayload | null;
}> {
  const [email, passwordHash, payloadJson] = await Promise.all([
    SecureStore.getItemAsync(EMAIL_KEY),
    SecureStore.getItemAsync(HASH_KEY),
    SecureStore.getItemAsync(PAYLOAD_KEY),
  ]);
  let payload: CachedAuthPayload | null = null;
  if (payloadJson) {
    try {
      payload = JSON.parse(payloadJson) as CachedAuthPayload;
    } catch {
      payload = null;
    }
  }
  return { email, passwordHash, payload };
}

/** Returns true if login matches stored offline credentials and payload is present. */
export async function verifyOfflineLogin(
  email: string,
  password: string
): Promise<CachedAuthPayload | null> {
  const { email: storedEmail, passwordHash, payload } = await getOfflineCredentials();
  if (!storedEmail || !passwordHash || !payload) return null;
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail !== storedEmail) return null;
  const hash = await hashPassword(password);
  if (hash !== passwordHash) return null;
  return payload;
}
