import type { TokenPayload, UserRole } from "./types";

export function decodePayload(token: string): TokenPayload | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }
}

export function getStoredUser(): { email: string; role: UserRole } | null {
  if (typeof window === "undefined") return null;
  const access = localStorage.getItem("access");
  if (!access) return null;
  const payload = decodePayload(access);
  if (!payload?.email || !payload?.role) return null;
  return { email: payload.email, role: payload.role as UserRole };
}
