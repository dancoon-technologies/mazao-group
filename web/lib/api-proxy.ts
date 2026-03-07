/**
 * Server-only helpers for Next.js API routes that proxy to the backend.
 * Enterprise: consistent auth, validation, and error handling.
 */

import { getAccessToken } from "@/lib/auth-server";
import { BACKEND_API } from "@/lib/auth-server";

const DEFAULT_TIMEOUT_MS = 25000;

export type ProxyOptions = {
  /** Request timeout in ms. */
  timeout?: number;
};

/**
 * Ensure user is authenticated; return 401 response or the access token.
 */
export async function requireAuth(): Promise<{ token: string } | Response> {
  const access = await getAccessToken();
  if (!access) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }
  return { token: access };
}

/**
 * Proxy GET to the backend with auth. Use after requireAuth().
 */
export async function proxyGet(
  path: string,
  token: string,
  options: ProxyOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${BACKEND_API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Parse and clamp an integer query param. Returns null if invalid.
 */
export function parseDaysParam(value: string | null, min = 7, max = 90): number | null {
  if (value == null) return null;
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < min || n > max) return null;
  return n;
}
