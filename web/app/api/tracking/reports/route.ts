import { requireAuth, proxyGet } from "@/lib/api-proxy";
import { BACKEND_API } from "@/lib/auth-server";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  const path = qs ? `/tracking/reports/?${qs}` : "/tracking/reports/";

  let res: Response;
  try {
    res = await proxyGet(path, auth.token);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backend request failed";
    return Response.json(
      { detail: `Tracking reports unavailable: ${message}. Is the backend running?` },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return Response.json(err, { status: res.status });
  }

  const data = await res.json();
  return Response.json(data);
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => ({}));
  let res: Response;
  try {
    res = await fetch(`${BACKEND_API}/tracking/reports/batch/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backend request failed";
    return Response.json(
      { detail: `Tracking submit unavailable: ${message}. Is the backend running?` },
      { status: 502 }
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return Response.json(data, { status: res.status });
  }
  return Response.json(data);
}
