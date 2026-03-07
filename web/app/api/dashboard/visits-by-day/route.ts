import { requireAuth, proxyGet, parseDaysParam } from "@/lib/api-proxy";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const daysParam = parseDaysParam(searchParams.get("days"));
  const days = daysParam ?? 14;

  let res: Response;
  try {
    res = await proxyGet(`/dashboard/visits-by-day/?days=${days}`, auth.token);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backend request failed";
    return Response.json(
      { detail: `Visits by day unavailable: ${message}. Is the backend running?` },
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
