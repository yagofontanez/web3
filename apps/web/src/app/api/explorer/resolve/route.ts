import { NextResponse } from "next/server";
import { resolveQuery } from "@w3s/explorer";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.session.activeOrganizationId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q || q.length > 255) return NextResponse.json({ ok: false, reason: "invalid" });
  return NextResponse.json(await resolveQuery(q));
}
