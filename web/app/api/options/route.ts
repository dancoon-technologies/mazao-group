import { getAccessToken } from "@/lib/auth-server";
import { BACKEND_API } from "@/lib/auth-server";

/** GET: Option sets (departments, staff_roles) from backend. */
export async function GET() {
  const access = await getAccessToken();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (access) headers["Authorization"] = `Bearer ${access}`;
  const res = await fetch(`${BACKEND_API.replace(/\/$/, "")}/options/`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return Response.json(err, { status: res.status });
  }
  const data = await res.json();
  return Response.json(data);
}
