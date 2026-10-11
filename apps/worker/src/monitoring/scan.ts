import type { AlertPayload, EventParams, TransferParams } from "@w3s/db/schema";
import { decodeEvent, networkBySlug, parseEventSignature, rpc } from "@w3s/explorer";
import { chunks, mergeTransfers, transferMatches, transferToAlert, type MonitorLike, type RawTransfer } from "./match";

const LOGS_RANGE = Math.max(1, Number(process.env.ALCHEMY_GETLOGS_RANGE ?? 10));

const hex = (n: number) => `0x${n.toString(16)}`;

export async function latestBlock(network: string) {
  const net = networkBySlug(network);
  if (!net) throw new Error(`Unknown network ${network}`);
  return Number.parseInt(await rpc<string>(net.alchemy, "eth_blockNumber", []), 16);
}

async function transfers(alchemy: string, side: "fromAddress" | "toAddress", address: string, from: number, to: number, params: TransferParams, internal: boolean) {
  const category = params.asset === "native" ? ["external", ...(internal ? ["internal"] : [])] : params.asset === "any" ? ["external", "erc20", ...(internal ? ["internal"] : [])] : ["erc20"];
  const out: RawTransfer[] = [];
  let pageKey: string | undefined;
  let pages = 0;
  do {
    const res = await rpc<{ transfers: RawTransfer[]; pageKey?: string }>(alchemy, "alchemy_getAssetTransfers", [
      {
        fromBlock: hex(from),
        toBlock: hex(to),
        [side]: address,
        category,
        withMetadata: true,
        excludeZeroValue: true,
        order: "asc",
        maxCount: "0x64",
        ...(params.asset !== "any" && params.asset !== "native" ? { contractAddresses: [params.asset] } : {}),
        ...(pageKey ? { pageKey } : {}),
      },
    ]);
    out.push(...res.transfers);
    pageKey = res.pageKey;
    pages++;
  } while (pageKey && pages < 5);
  return out;
}

export async function scanMonitor(m: MonitorLike, from: number, to: number): Promise<{ dedupeKey: string; payload: AlertPayload }[]> {
  const net = networkBySlug(m.network);
  if (!net) throw new Error(`Unknown network ${m.network}`);

  if (m.kind === "transfer") {
    const params = m.params as TransferParams;
    const sides: ("fromAddress" | "toAddress")[] = params.direction === "in" ? ["toAddress"] : params.direction === "out" ? ["fromAddress"] : ["toAddress", "fromAddress"];
    const lists = await Promise.all(sides.map((s) => transfers(net.alchemy, s, m.address, from, to, params, net.internalTransfers)));
    return mergeTransfers(...lists)
      .filter((t) => transferMatches(params, t))
      .map((t) => transferToAlert(m.address, m.network, t));
  }

  const parsed = parseEventSignature((m.params as EventParams).signature);
  if ("error" in parsed) throw new Error(parsed.error);
  type Log = { transactionHash: string; logIndex: string; blockNumber: string; data: `0x${string}`; topics: `0x${string}`[]; removed?: boolean };
  const logs: Log[] = [];
  const windows = chunks(from, to, LOGS_RANGE);
  for (let i = 0; i < windows.length; i += 4) {
    const batch = await Promise.all(
      windows.slice(i, i + 4).map((w) => rpc<Log[]>(net.alchemy, "eth_getLogs", [{ address: m.address, fromBlock: hex(w.from), toBlock: hex(w.to), topics: [parsed.topic0] }])),
    );
    for (const b of batch) logs.push(...b);
  }
  return logs
    .filter((l) => !l.removed)
    .map((l) => ({
      dedupeKey: `${l.transactionHash}:${Number.parseInt(l.logIndex, 16)}`,
      payload: {
        kind: "event" as const,
        network: m.network,
        txHash: l.transactionHash,
        blockNumber: Number.parseInt(l.blockNumber, 16),
        timestamp: null,
        address: m.address,
        event: parsed.name,
        args: decodeEvent(parsed, l) ?? {},
      },
    }));
}
