/**
 * Tests for JWT decode and token helpers (client-side read-only).
 */

import {
  decodeJwtPayload,
  getMustChangePasswordFromToken,
  isTokenExpired,
} from '@/lib/jwt';

/** Build a minimal JWT payload part (base64url). */
function base64urlEncode(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj);
  const base64 = typeof Buffer !== 'undefined'
    ? Buffer.from(json, 'utf8').toString('base64')
    : btoa(unescape(encodeURIComponent(json)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeToken(payload: Record<string, unknown>): string {
  const header = base64urlEncode({ alg: 'HS256', typ: 'JWT' });
  const payloadB64 = base64urlEncode(payload);
  return `${header}.${payloadB64}.sig`;
}

describe('decodeJwtPayload', () => {
  it('returns payload object for valid token', () => {
    const payload = { sub: 'user-1', exp: 9999999999 };
    const token = makeToken(payload);
    expect(decodeJwtPayload(token)).toEqual(payload);
  });

  it('returns null for null or empty string', () => {
    expect(decodeJwtPayload(null)).toBeNull();
    expect(decodeJwtPayload('')).toBeNull();
  });

  it('returns null for token with wrong number of parts', () => {
    expect(decodeJwtPayload('onlyone')).toBeNull();
    expect(decodeJwtPayload('a.b')).toBeNull();
    expect(decodeJwtPayload('a.b.c.d')).toBeNull();
  });

  it('returns null for invalid base64 payload', () => {
    expect(decodeJwtPayload('a.!!!invalid!!!.c')).toBeNull();
  });

  it('returns null for invalid JSON in payload', () => {
    const badB64 = base64urlEncode({ not: 'json' }).slice(0, 5);
    expect(decodeJwtPayload(`a.${badB64}.c`)).toBeNull();
  });
});

describe('getMustChangePasswordFromToken', () => {
  it('returns true when must_change_password is true', () => {
    const token = makeToken({ must_change_password: true });
    expect(getMustChangePasswordFromToken(token)).toBe(true);
  });

  it('returns false when must_change_password is false or missing', () => {
    expect(getMustChangePasswordFromToken(makeToken({}))).toBe(false);
    expect(getMustChangePasswordFromToken(makeToken({ must_change_password: false }))).toBe(false);
  });

  it('returns false for null token', () => {
    expect(getMustChangePasswordFromToken(null)).toBe(false);
  });
});

describe('isTokenExpired', () => {
  it('returns true for null or invalid token', () => {
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired('a.b.c')).toBe(true); // payload may decode but exp missing
  });

  it('returns false when exp is in the future (with buffer)', () => {
    const exp = Math.floor(Date.now() / 1000) + 120; // 2 min from now
    const token = makeToken({ exp });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('returns true when exp is in the past', () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    const token = makeToken({ exp });
    expect(isTokenExpired(token)).toBe(true);
  });
});
