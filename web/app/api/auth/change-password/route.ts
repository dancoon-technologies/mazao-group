import { cookies } from "next/headers";
import {
  BACKEND_API,
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
  getAccessToken,
  decodePayload,
} from "@/lib/auth-server";
import { ROLES } from "@/lib/constants";

export async function POST(request: Request) {
  const access = await getAccessToken();
  if (!access) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const current_password =
    typeof body.current_password === "string" ? body.current_password : "";
  const new_password =
    typeof body.new_password === "string" ? body.new_password : "";

  if (!current_password || !new_password) {
    return Response.json(
      { detail: "current_password and new_password are required." },
      { status: 400 }
    );
  }

  const res = await fetch(`${BACKEND_API}/auth/change-password/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access}`,
    },
    body: JSON.stringify({
      current_password,
      new_password,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return Response.json(data, { status: res.status });
  }

  const newAccess = (data as { access?: string }).access;
  const newRefresh = (data as { refresh?: string }).refresh;

  if (!newAccess || !newRefresh) {
    return Response.json(
      { detail: "Invalid change-password response" },
      { status: 502 }
    );
  }

  const payload = decodePayload(newAccess);
  const user = {
    email: payload?.email ?? "",
    role: payload?.role ?? ROLES.OFFICER,
    must_change_password: payload?.must_change_password ?? false,
  };

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_ACCESS, newAccess, COOKIE_OPTIONS);
  cookieStore.set(COOKIE_REFRESH, newRefresh, REFRESH_COOKIE_OPTIONS);

  return Response.json({ user, detail: "Password changed successfully." });
}
