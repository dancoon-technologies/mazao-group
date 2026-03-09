const envUrl = process.env.EXPO_PUBLIC_API_URL;
if (typeof envUrl !== 'string' || !envUrl.trim()) {
  throw new Error('EXPO_PUBLIC_API_URL is required. Set it in .env or app config.');
}
export const API_BASE = envUrl.trim();

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
