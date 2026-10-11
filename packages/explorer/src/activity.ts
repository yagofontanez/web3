import { pricesApi, rpc } from "./alchemy";
import { cached } from "./cache";
import { ExplorerError, type ExplorerErrorCode } from "./errors";
import { decodeCursor, encodeCursor } from "./format";
import type { ExplorerNetwork } from "./networks";

export type ActivityItem = {
  id: string;
  hash: string;
  blockNumber: number;
  timestamp: string | null;
  direction: "in" | "out" | "self";
  category: string;
  asset: string | null;
  contract: string | null;
  value: number | null;
  tokenId: string | null;
  counterparty: string | null;
  verified: boolean;
};

export type ActivityPage = {
  items: ActivityItem[];
  nextCursor: string | null;
  error: ExplorerErrorCode | null;
};

type RawTransfer = {
  uniqueId: string;
  hash: string;
  blockNum: string;
  from: string;
  to: string | null;
  value: number | null;
  asset: string | null;
  category: string;
  erc721TokenId: string | null;
  tokenId: string | null;
  rawContract: { address: string | null };
  metadata?: { blockTimestamp?: string };
};

type Cursor = { in: string | null; out: string | null };

const PAGE = 25;

export function toActivity(address: string, t: RawTransfer): ActivityItem {
  const me = address.toLowerCase();
  const from = t.from?.toLowerCase();
  const to = t.to?.toLowerCase() ?? null;
  const direction = from === me && to === me ? "self" : from === me ? "out" : "in";
  const native = t.category === "external" || t.category === "internal";
  return {
    id: t.uniqueId,
    hash: t.hash,
    blockNumber: Number.parseInt(t.blockNum, 16),
    timestamp: t.metadata?.blockTimestamp ?? null,
    direction,
    category: t.category,
    asset: t.asset,
    contract: native ? null : (t.rawContract.address ?? null),
    value: t.value,
    tokenId: t.tokenId ?? t.erc721TokenId ?? null,
    counterparty: direction === "out" ? to : from,
    verified: native,
  };
}

export function mergeActivity(a: ActivityItem[], b: ActivityItem[]): ActivityItem[] {
  const byId = new Map<string, ActivityItem>();
  for (const item of [...a, ...b]) {
    const existing = byId.get(item.id);
    byId.set(item.id, existing && existing.direction !== item.direction ? { ...item, direction: "self" } : item);
  }
  return [...byId.values()].sort((x, y) => y.blockNumber - x.blockNumber);
}

async function verifiedContracts(network: ExplorerNetwork, contracts: string[]): Promise<Set<string>> {
  const unique = [...new Set(contracts.map((c) => c.toLowerCase()))];
  const verified = new Set<string>();
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 25) chunks.push(unique.slice(i, i + 25));
  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const res = await pricesApi<{ data: { address: string; prices: { value: string }[] }[] }>("tokens/by-address", {
          addresses: chunk.map((address) => ({ network: network.alchemy, address })),
        });
        for (const row of res.data) {
          if (row.prices?.some((p) => Number(p.value) > 0)) verified.add(row.address.toLowerCase());
        }
      } catch {}
    }),
  );
  return verified;
}

async function direction(
  address: string,
  network: ExplorerNetwork,
  side: "fromAddress" | "toAddress",
  pageKey: string | null | undefined,
) {
  if (pageKey === null) return { transfers: [] as RawTransfer[], pageKey: null };
  const category = ["external", "erc20", "erc721", "erc1155", ...(network.internalTransfers ? ["internal"] : [])];
  const res = await rpc<{ transfers: RawTransfer[]; pageKey?: string }>(network.alchemy, "alchemy_getAssetTransfers", [
    {
      fromBlock: "0x0",
      [side]: address,
      category,
      withMetadata: true,
      order: "desc",
      maxCount: `0x${PAGE.toString(16)}`,
      excludeZeroValue: true,
      ...(pageKey ? { pageKey } : {}),
    },
  ]);
  return { transfers: res.transfers, pageKey: res.pageKey ?? null };
}

async function load(address: string, network: ExplorerNetwork, cursor: Cursor | undefined): Promise<ActivityPage> {
  const [incoming, outgoing] = await Promise.all([
    direction(address, network, "toAddress", cursor ? cursor.in : undefined),
    direction(address, network, "fromAddress", cursor ? cursor.out : undefined),
  ]);
  const items = mergeActivity(
    incoming.transfers.map((t) => toActivity(address, t)),
    outgoing.transfers.map((t) => toActivity(address, t)),
  );
  const tokenContracts = items.filter((i) => i.category === "erc20" && i.contract).map((i) => i.contract!);
  const verified = await verifiedContracts(network, tokenContracts);
  for (const item of items) {
    if (item.category === "erc20" && item.contract) item.verified = verified.has(item.contract.toLowerCase());
    if (item.category === "erc721" || item.category === "erc1155") item.verified = true;
  }
  const next: Cursor = { in: incoming.pageKey, out: outgoing.pageKey };
  return { items, nextCursor: next.in || next.out ? encodeCursor(next) : null, error: null };
}

export async function getActivity(address: string, network: ExplorerNetwork, cursor?: string | null): Promise<ActivityPage> {
  const decoded = decodeCursor<Cursor>(cursor);
  try {
    return await cached(`activity:${network.slug}:${address.toLowerCase()}:${cursor ?? "0"}`, 30, () =>
      load(address, network, decoded),
    );
  } catch (err) {
    return { items: [], nextCursor: null, error: err instanceof ExplorerError ? err.code : "upstream" };
  }
}
