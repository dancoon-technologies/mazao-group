import { requireAuth, proxyGet, parseDaysParam } from "@/lib/api-proxy";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const days = parseDaysParam(searchParams.get("days"), 1, 365) ?? 30;

  let res: Response;
  try {
    res = await proxyGet(`/dashboard/staff-ranking/?days=${days}`, auth.token);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backend request failed";
    return Response.json(
      { detail: `Staff ranking unavailable: ${message}. Is the backend running?` },
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

