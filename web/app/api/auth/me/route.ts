import { cookies } from "next/headers";
import {
  BACKEND_API,
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
  decodePayload,
} from "@/lib/auth-server";

export async function GET() {
  const cookieStore = await cookies();
  let access = cookieStore.get(COOKIE_ACCESS)?.value;
  const refresh = cookieStore.get(COOKIE_REFRESH)?.value;

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

  if (!access) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const payload = decodePayload(access);
  if (!payload?.email || !payload?.role) {
    return Response.json({ detail: "Invalid token" }, { status: 401 });
  }

  return Response.json({
    user: {
      email: payload.email,
      role: payload.role,
      must_change_password: payload.must_change_password ?? false,
    },
  });
}
