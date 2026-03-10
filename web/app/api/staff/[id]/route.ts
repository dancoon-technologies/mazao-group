import { getAccessToken } from "@/lib/auth-server";
import { BACKEND_API } from "@/lib/auth-server";

const baseUrl = () => BACKEND_API.replace(/\/$/, "");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getAccessToken();
  if (!access) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const staffId = (id ?? "").replace(/\/$/, "");
  if (!staffId) {
    return Response.json({ detail: "Staff ID is required." }, { status: 400 });
  }

  const res = await fetch(`${baseUrl()}/staff/${staffId}/`, {
    headers: { Authorization: `Bearer ${access}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return Response.json(data, { status: res.status });
  }
  return Response.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getAccessToken();
  if (!access) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const staffId = (id ?? "").replace(/\/$/, "");
  if (!staffId) {
    return Response.json({ detail: "Staff ID is required." }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const res = await fetch(`${baseUrl()}/staff/${staffId}/`, {
    method: "PATCH",
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
