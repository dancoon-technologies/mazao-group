import { getAccessToken } from "@/lib/auth-server";
import { BACKEND_API } from "@/lib/auth-server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getAccessToken();
  if (!access) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const res = await fetch(`${BACKEND_API}/notifications/${id}/archive/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}` },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  }
  return new Response(null, { status: 204 });
}
