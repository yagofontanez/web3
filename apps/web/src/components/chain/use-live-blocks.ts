"use client";

import { createContext, createElement, use, useEffect, useState, type ReactNode } from "react";
import type { Block } from "viem";
import { usePublicClient } from "wagmi";
import { base } from "wagmi/chains";

export type LiveBlock = {
  number: bigint;
  hash: `0x${string}`;
  txCount: number;
  gasPct: number;
  timestamp: number;
};

const toLive = (b: Block): LiveBlock | null =>
  b.number == null || !b.hash
    ? null
    : {
        number: b.number,
        hash: b.hash,
        txCount: b.transactions.length,
        gasPct: b.gasLimit > 0n ? Number((b.gasUsed * 1000n) / b.gasLimit) / 10 : 0,
        timestamp: Number(b.timestamp),
      };

function useLiveBlocksSource(keep: number) {
  const client = usePublicClient({ chainId: base.id });
  const [blocks, setBlocks] = useState<LiveBlock[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    const push = (incoming: LiveBlock[]) =>
      setBlocks((prev) => {
        const byNumber = new Map(prev.map((b) => [b.number, b]));
        for (const b of incoming) byNumber.set(b.number, b);
        return [...byNumber.values()].sort((a, b) => (a.number > b.number ? -1 : 1)).slice(0, keep);
      });

    (async () => {
      try {
        const latest = await client.getBlockNumber();
        const history = await Promise.all(
          Array.from({ length: keep }, (_, i) => client.getBlock({ blockNumber: latest - BigInt(i) })),
        );
        if (!cancelled) push(history.map(toLive).filter((b): b is LiveBlock => b !== null));
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    const unwatch = client.watchBlocks({
      pollingInterval: 2_000,
      onBlock: (b) => {
        const live = toLive(b);
        if (live && !cancelled) {
          setError(false);
          push([live]);
        }
      },
      onError: () => !cancelled && setError(true),
    });

    return () => {
      cancelled = true;
      unwatch();
    };
  }, [client, keep]);

  return { blocks, latest: blocks[0], error };
}

type LiveBlocksState = ReturnType<typeof useLiveBlocksSource>;
const LiveBlocksContext = createContext<LiveBlocksState | null>(null);

export function LiveBlocksProvider({ keep = 8, children }: { keep?: number; children: ReactNode }) {
  return createElement(LiveBlocksContext, { value: useLiveBlocksSource(keep) }, children);
}

export function useLiveBlocks() {
  const state = use(LiveBlocksContext);
  if (!state) throw new Error("useLiveBlocks must be used inside LiveBlocksProvider");
  return state;
}
