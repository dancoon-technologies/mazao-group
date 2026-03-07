import { NextRequest } from "next/server";
import { getAccessToken } from "@/lib/auth-server";
import { BACKEND_API } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const access = await getAccessToken();
  if (!access) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const officer = searchParams.get("officer");
  const date = searchParams.get("date");
  const department = searchParams.get("department");
  const qs = new URLSearchParams();
  if (officer) qs.set("officer", officer);
  if (date) qs.set("date", date);
  if (department) qs.set("department", department);
  const suffix = qs.toString() ? `?${qs}` : "";

  let res: Response;
  try {
    res = await fetch(`${BACKEND_API}/visits/${suffix}`, {
      headers: { Authorization: `Bearer ${access}` },
    });
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined;
    const code = cause && typeof cause === "object" && "code" in cause ? (cause as { code?: string }).code : undefined;
    if (code === "ECONNREFUSED") {
      return Response.json(
        { detail: "Backend is unreachable. Start the Django server (e.g. python manage.py runserver)." },
        { status: 503 }
      );
    }
    throw err;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return Response.json(err, { status: res.status });
  }

  const data = await res.json();
  return Response.json(data);
}
