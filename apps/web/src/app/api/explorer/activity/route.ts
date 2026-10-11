import { NextResponse } from "next/server";
import { getActivity } from "@w3s/explorer";
import { guard } from "../guard";

export async function GET(request: Request) {
  const g = await guard(request);
  if (!g.ok) return g.response;
  return NextResponse.json(await getActivity(g.address, g.network, g.cursor));
}
