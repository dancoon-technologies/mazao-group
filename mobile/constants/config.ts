export const API_BASE = process.env.EXPO_PUBLIC_API_URL as string;

/** Base URL for API including /api; sync pull/push use API_BASE + 'mobile/sync/' */
export const SYNC_PULL_PATH = 'mobile/sync/pull/'
export const SYNC_PUSH_PATH = 'mobile/sync/push/'

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  BIOMETRIC_UNLOCKED: 'biometric_unlocked',
} as const

export const LAST_SYNC_KEY = 'mazao_last_sync'
