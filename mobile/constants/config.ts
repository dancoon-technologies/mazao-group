export const API_BASE = process.env.EXPO_PUBLIC_API_URL as string;

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  BIOMETRIC_UNLOCKED: 'biometric_unlocked',
} as const;
