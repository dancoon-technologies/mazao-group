/**
 * Decode JWT payload without verification (for reading our own token from backend).
 * Payload is base64url-encoded JSON. Uses atob (available in Expo/React Native).
 */
export function decodeJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getMustChangePasswordFromToken(token: string | null): boolean {
  const payload = decodeJwtPayload(token);
  return Boolean(payload && payload.must_change_password === true);
}

/**
 * Check if a JWT token is expired.
 * Returns true if expired or invalid, false if still valid.
 * Adds a small buffer (30 seconds) to account for clock skew.
 */
export function isTokenExpired(token: string | null): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const bufferSeconds = 30;
  return payload.exp < nowSeconds + bufferSeconds;
}
