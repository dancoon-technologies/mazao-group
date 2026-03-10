import { requireAuth, proxyGet } from "@/lib/api-proxy";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let res: Response;
  try {
    res = await proxyGet("/dashboard/schedules-summary/", auth.token);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backend request failed";
    return Response.json(
      { detail: `Schedules summary unavailable: ${message}. Is the backend running?` },
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
