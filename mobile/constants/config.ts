const envUrl = typeof process.env.EXPO_PUBLIC_API_URL === 'string' ? process.env.EXPO_PUBLIC_API_URL.trim() : '';
/** True when API base URL is set (avoids crash on missing env in production builds). */
export const hasValidApiBase = envUrl.length > 0;
export const API_BASE = envUrl;

/** Base URL for API including /api; sync pull/push use API_BASE + 'mobile/sync/' */
export const SYNC_PULL_PATH = 'mobile/sync/pull/'
export const SYNC_PUSH_PATH = 'mobile/sync/push/'

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  BIOMETRIC_UNLOCKED: 'biometric_unlocked',
  /** Stored after successful online login for offline login. */
  OFFLINE_EMAIL: 'offline_email',
  OFFLINE_PASSWORD_HASH: 'offline_password_hash',
  CACHED_AUTH_PAYLOAD: 'cached_auth_payload',
} as const

export const LAST_SYNC_KEY = 'mazao_last_sync'
