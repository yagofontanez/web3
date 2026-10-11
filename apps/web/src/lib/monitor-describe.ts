import { networkBySlug } from "@w3s/explorer";
import type { EventParams, TransferParams } from "@w3s/db/schema";

export function describeMonitor(m: { kind: string; params: TransferParams | EventParams; network: string }) {
  const net = networkBySlug(m.network)?.name ?? m.network;
  if (m.kind === "event") return `${(m.params as EventParams).signature.split("(")[0]} events on ${net}`;
  const p = m.params as TransferParams;
  const dir = p.direction === "in" ? "Incoming" : p.direction === "out" ? "Outgoing" : "Any";
  const asset = p.asset === "any" ? "transfers" : p.asset === "native" ? "native transfers" : `transfers of ${p.asset.slice(0, 6)}…${p.asset.slice(-4)}`;
  return `${dir} ${asset}${p.minAmount ? ` of ${Number(p.minAmount).toLocaleString("en")}+` : ""} on ${net}`;
}
