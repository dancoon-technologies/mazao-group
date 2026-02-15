import { cookies } from "next/headers";
import { COOKIE_ACCESS, COOKIE_REFRESH } from "@/lib/auth-server";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_ACCESS, "", { path: "/", maxAge: 0 });
  cookieStore.set(COOKIE_REFRESH, "", { path: "/", maxAge: 0 });
  return Response.json({ ok: true });
}
