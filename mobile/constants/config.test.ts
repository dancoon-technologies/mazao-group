/**
 * Tests for app config constants.
 */

import {
  hasValidApiBase,
  API_BASE,
  SYNC_PULL_PATH,
  SYNC_PUSH_PATH,
  STORAGE_KEYS,
  LAST_SYNC_KEY,
} from '@/constants/config';

describe('config', () => {
  it('SYNC_PULL_PATH and SYNC_PUSH_PATH are non-empty strings', () => {
    expect(typeof SYNC_PULL_PATH).toBe('string');
    expect(SYNC_PULL_PATH.length).toBeGreaterThan(0);
    expect(typeof SYNC_PUSH_PATH).toBe('string');
    expect(SYNC_PUSH_PATH.length).toBeGreaterThan(0);
  });

  it('STORAGE_KEYS contains expected keys', () => {
    expect(STORAGE_KEYS).toHaveProperty('ACCESS_TOKEN', 'access_token');
    expect(STORAGE_KEYS).toHaveProperty('REFRESH_TOKEN', 'refresh_token');
    expect(STORAGE_KEYS).toHaveProperty('CACHED_AUTH_PAYLOAD', 'cached_auth_payload');
  });

  it('LAST_SYNC_KEY is a non-empty string', () => {
    expect(typeof LAST_SYNC_KEY).toBe('string');
    expect(LAST_SYNC_KEY.length).toBeGreaterThan(0);
  });

  it('API_BASE is a string', () => {
    expect(typeof API_BASE).toBe('string');
  });

  it('hasValidApiBase is boolean', () => {
    expect(typeof hasValidApiBase).toBe('boolean');
  });
});
