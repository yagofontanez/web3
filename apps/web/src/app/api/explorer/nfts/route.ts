import { NextResponse } from "next/server";
import { getNfts } from "@w3s/explorer";
import { guard } from "../guard";

export async function GET(request: Request) {
  const g = await guard(request);
  if (!g.ok) return g.response;
  return NextResponse.json(await getNfts(g.address, g.network, g.cursor));
}
