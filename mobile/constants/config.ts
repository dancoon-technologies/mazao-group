/**
 * Backend API base URL. For device/emulator use your machine IP (e.g. http://192.168.1.x:8000/api)
 * or use Expo tunnel and point to your deployed API.
 */
export const API_BASE =
  (process as unknown as { env?: { EXPO_PUBLIC_API_URL?: string } }).env?.EXPO_PUBLIC_API_URL ??
  'http://localhost:8000/api';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  BIOMETRIC_UNLOCKED: 'biometric_unlocked',
} as const;
