import type { AlertPayload, EventParams, TransferParams } from "@w3s/db/schema";

export type RawTransfer = {
  uniqueId: string;
  hash: string;
  blockNum: string;
  from: string;
  to: string | null;
  value: number | null;
  asset: string | null;
  category: string;
  rawContract: { address: string | null };
  metadata?: { blockTimestamp?: string };
};

export type MonitorLike = {
  id: string;
  name: string;
  kind: "transfer" | "event";
  network: string;
  address: string;
  params: TransferParams | EventParams;
};

export const NATIVE_CATEGORIES = new Set(["external", "internal"]);

export function transferMatches(params: TransferParams, t: RawTransfer) {
  const native = NATIVE_CATEGORIES.has(t.category);
  if (params.asset === "native" && !native) return false;
  if (params.asset !== "any" && params.asset !== "native" && t.rawContract.address?.toLowerCase() !== params.asset.toLowerCase()) return false;
  if (params.minAmount !== null && params.minAmount !== "") {
    const min = Number(params.minAmount);
    if (Number.isFinite(min) && (t.value === null || t.value < min)) return false;
  }
  return true;
}

export function transferToAlert(watched: string, network: string, t: RawTransfer): { dedupeKey: string; payload: AlertPayload } {
  const me = watched.toLowerCase();
  const from = t.from?.toLowerCase();
  const to = t.to?.toLowerCase() ?? null;
  const direction = from === me && to === me ? "self" : from === me ? "out" : "in";
  return {
    dedupeKey: t.uniqueId,
    payload: {
      kind: "transfer",
      network,
      txHash: t.hash,
      blockNumber: Number.parseInt(t.blockNum, 16),
      timestamp: t.metadata?.blockTimestamp ?? null,
      address: watched,
      direction,
      asset: t.asset,
      tokenAddress: NATIVE_CATEGORIES.has(t.category) ? null : t.rawContract.address,
      value: t.value === null ? null : String(t.value),
      from: t.from,
      to: t.to,
    },
  };
}

export function mergeTransfers(...lists: RawTransfer[][]) {
  const byId = new Map<string, RawTransfer>();
  for (const list of lists) for (const t of list) byId.set(t.uniqueId, t);
  return [...byId.values()].sort((a, b) => Number.parseInt(a.blockNum, 16) - Number.parseInt(b.blockNum, 16));
}

export const MAX_RANGE = 2000;
export const MAX_EVENT_RANGE = 300;
export const BURST_THRESHOLD = 25;
export const BURST_SAMPLE = 5;
export const HOURLY_PAUSE_LIMIT = 200;

export function nextRange(lastChecked: number | null, latest: number, maxRange = MAX_RANGE): { from: number; to: number } | null {
  if (lastChecked === null) return null;
  if (latest <= lastChecked) return null;
  const from = lastChecked + 1;
  return { from, to: Math.min(latest, from + maxRange - 1) };
}

export function chunks(from: number, to: number, size: number) {
  const out: { from: number; to: number }[] = [];
  for (let start = from; start <= to; start += size) out.push({ from: start, to: Math.min(to, start + size - 1) });
  return out;
}

export function throttle<T>(found: T[]): { send: T[]; suppressed: number } {
  if (found.length <= BURST_THRESHOLD) return { send: found, suppressed: 0 };
  return { send: found.slice(0, BURST_SAMPLE), suppressed: found.length - BURST_SAMPLE };
}
