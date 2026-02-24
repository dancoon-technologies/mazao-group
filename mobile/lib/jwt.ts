/**
 * Decode JWT payload without verification (for reading our own token from backend).
 * Payload is base64url-encoded JSON.
 */
export function decodeJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getMustChangePasswordFromToken(token: string | null): boolean {
  const payload = decodeJwtPayload(token);
  return Boolean(payload && payload.must_change_password === true);
}
