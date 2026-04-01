import { NextRequest } from "next/server";
import { getAccessToken } from "@/lib/auth-server";
import { BACKEND_API } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const access = await getAccessToken();
  if (!access) return Response.json({ detail: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const officer = searchParams.get("officer");
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (officer) qs.set("officer", officer);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`${BACKEND_API}/maintenance-incidents/${suffix}`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json(data, { status: res.status });
  return Response.json(data);
}

export async function POST(request: Request) {
  const access = await getAccessToken();
  if (!access) return Response.json({ detail: "Not authenticated" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const res = await fetch(`${BACKEND_API}/maintenance-incidents/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json(data, { status: res.status });
  return Response.json(data);
}
