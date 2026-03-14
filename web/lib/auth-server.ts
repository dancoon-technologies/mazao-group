/**
 * Server-only: decode JWT payload (no verification, for reading user from cookie).
 */

export interface TokenPayload {
  email?: string;
  role?: string;
  exp?: number;
  must_change_password?: boolean;
}

export function decodePayload(token: string): TokenPayload | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    const json = Buffer.from(base64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }
}

export const BACKEND_API =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const COOKIE_ACCESS = "access_token";
export const COOKIE_REFRESH = "refresh_token";

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 3600, // 1 hour
};

export const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: 604800, // 7 days
};

/**
 * Get access token from cookies; refresh if missing/expired. Returns null if not authenticated.
 */
export async function getAccessToken(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  let access = cookieStore.get(COOKIE_ACCESS)?.value ?? null;
  const refresh = cookieStore.get(COOKIE_REFRESH)?.value ?? null;

  if (!access && refresh) {
    const res = await fetch(`${BACKEND_API}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    const data = (await res.json().catch(() => ({}))) as { access?: string; refresh?: string };
    if (res.ok && data.access) {
      access = data.access;
      cookieStore.set(COOKIE_ACCESS, data.access, COOKIE_OPTIONS);
      if (data.refresh) {
        cookieStore.set(COOKIE_REFRESH, data.refresh, REFRESH_COOKIE_OPTIONS);
      }
    }
  }

  return access;
}
