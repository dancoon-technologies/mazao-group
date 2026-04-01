import { getAccessToken } from "@/lib/auth-server";
import { BACKEND_API } from "@/lib/auth-server";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await getAccessToken();
  if (!access) return Response.json({ detail: "Not authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const res = await fetch(`${BACKEND_API}/maintenance-incidents/${encodeURIComponent(id)}/`, {
    method: "PATCH",
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
