import { NextRequest } from "next/server";
import { getAccessToken } from "@/lib/auth-server";
import { BACKEND_API } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const access = await getAccessToken();
  if (!access) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const department = searchParams.get("department");
  const suffix = department ? `?department=${encodeURIComponent(department)}` : "";
  const res = await fetch(`${BACKEND_API.replace(/\/$/, "")}/schedules/${suffix}`, {
    headers: { Authorization: `Bearer ${access}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return Response.json(err, { status: res.status });
  }

  const data = await res.json();
  return Response.json(data);
}

export async function POST(request: Request) {
  const access = await getAccessToken();
  if (!access) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const res = await fetch(`${BACKEND_API}/schedules/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return Response.json(data, { status: res.status });
  }
  return Response.json(data);
}
