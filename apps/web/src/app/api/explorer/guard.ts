import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { networkBySlug, type ExplorerNetwork } from "@w3s/explorer";
import { auth } from "@/lib/auth";

export async function guard(
  request: Request,
): Promise<{ ok: true; address: `0x${string}`; network: ExplorerNetwork; cursor: string | null } | { ok: false; response: NextResponse }> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.session.activeOrganizationId) {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const params = new URL(request.url).searchParams;
  const address = params.get("address") ?? "";
  const network = networkBySlug(params.get("network"));
  if (!isAddress(address, { strict: false }) || !network) {
    return { ok: false, response: NextResponse.json({ error: "bad_request" }, { status: 400 }) };
  }
  const cursor = params.get("cursor");
  return { ok: true, address: getAddress(address), network, cursor: cursor && cursor.length < 4096 ? cursor : null };
}
