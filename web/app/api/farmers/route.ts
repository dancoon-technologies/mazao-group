import { NextRequest } from "next/server";
import { getAccessToken } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const access = await getAccessToken();
  if (!access) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { BACKEND_API } = await import("@/lib/auth-server");
  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  const base = BACKEND_API.replace(/\/$/, "");
  const url = qs ? `${base}/farmers/?${qs}` : `${base}/farmers/`;
  const res = await fetch(url, {
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

  const { BACKEND_API } = await import("@/lib/auth-server");
  const body = await request.json().catch(() => ({}));
  const res = await fetch(`${BACKEND_API}/farmers/`, {
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
