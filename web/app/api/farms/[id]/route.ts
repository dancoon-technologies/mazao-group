import { getAccessToken } from "@/lib/auth-server";
import { BACKEND_API } from "@/lib/auth-server";

function baseUrl() {
  return BACKEND_API.replace(/\/$/, "");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getAccessToken();
  if (!access) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const farmId = (id ?? "").replace(/\/$/, "");
  if (!farmId) {
    return Response.json({ detail: "Farm ID is required." }, { status: 400 });
  }

  const res = await fetch(`${baseUrl()}/farms/${farmId}/`, {
    headers: { Authorization: `Bearer ${access}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return Response.json(data, { status: res.status });
  }
  return Response.json(data);
}
