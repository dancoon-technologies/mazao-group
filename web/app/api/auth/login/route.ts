import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  BACKEND_API,
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
  decodePayload,
} from "@/lib/auth-server";
import { ROLES } from "@/lib/constants";
import { ROUTES } from "@/lib/constants";

export interface LoginResponse {
  user: { email: string; role: string };
}

/** GET /api/auth/login — redirect to login page (avoids "Method GET not allowed" when user hits this URL). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  return NextResponse.redirect(new URL(ROUTES.LOGIN, origin), 302);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return Response.json(
      { detail: "Email and password required." },
      { status: 400 }
    );
  }

  const loginUrl = `${BACKEND_API.replace(/\/$/, "")}/auth/login/`;
  const res = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const status = res.status;
    const detail =
      status >= 300 && status < 400
        ? "Backend returned redirect. Check API_URL."
        : (data as { detail?: string }).detail || "Login failed";
    return Response.json(
      { detail },
      { status: status >= 300 && status < 400 ? 502 : status }
    );
  }

  const access = (data as { access?: string }).access;
  const refresh = (data as { refresh?: string }).refresh;

  if (!access || !refresh) {
    return Response.json(
      { detail: "Invalid login response" },
      { status: 502 }
    );
  }

  const payload = decodePayload(access);
  const user = {
    email: payload?.email ?? "",
    role: payload?.role ?? ROLES.OFFICER,
    must_change_password: payload?.must_change_password ?? false,
  };

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_ACCESS, access, COOKIE_OPTIONS);
  cookieStore.set(COOKIE_REFRESH, refresh, REFRESH_COOKIE_OPTIONS);

  return Response.json({ user } satisfies LoginResponse);
}
