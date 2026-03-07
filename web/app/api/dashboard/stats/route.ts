import { requireAuth, proxyGet } from "@/lib/api-proxy";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const res = await proxyGet("/dashboard/stats/", auth.token);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return Response.json(err, { status: res.status });
  }

  const data = await res.json();
  return Response.json(data);
}
