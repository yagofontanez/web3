"use client";

import { formatGwei } from "viem";
import { useBlockNumber, useGasPrice } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import { LatestGlyph } from "../chain/live-glyph";
import { LiveBlocksProvider, useLiveBlocks } from "../chain/use-live-blocks";

function gwei(value: bigint | undefined) {
  if (value === undefined) return "…";
  const n = Number(formatGwei(value));
  return n < 0.01 ? "<0.01" : n.toLocaleString("en", { maximumFractionDigits: n < 1 ? 3 : 1 });
}

function ChainRow({ chainId, name }: { chainId: typeof mainnet.id | typeof base.id; name: string }) {
  const block = useBlockNumber({ chainId, watch: true });
  const gas = useGasPrice({ chainId, query: { refetchInterval: 15_000 } });
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-4 py-2.5 text-sm">
      <span>{name}</span>
      <span className="font-mono text-muted tabular-nums">{block.data ? `#${block.data.toLocaleString("en")}` : "…"}</span>
      <span className="w-20 text-right font-mono tabular-nums">
        {gwei(gas.data)} <span className="text-xs text-muted">gwei</span>
      </span>
    </div>
  );
}

function BaseCaption() {
  const { latest } = useLiveBlocks();
  return (
    <p className="text-xs text-muted">
      {latest ? `Base block ${latest.number.toLocaleString("en")}, ${latest.txCount} transactions, drawn from its hash.` : "Reading Base…"}
    </p>
  );
}

export function NetworkPulse() {
  return (
    <section aria-labelledby="pulse" className="theme-dark deep-surface flex flex-col gap-5 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <h2 id="pulse" className="font-semibold">
          Network pulse
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="size-1.5 rounded-full bg-verdigris" aria-hidden />
          Live
        </span>
      </div>
      <LiveBlocksProvider keep={1}>
        <div className="flex items-center gap-5">
          <LatestGlyph className="w-24 shrink-0" />
          <BaseCaption />
        </div>
      </LiveBlocksProvider>
      <div className="divide-y divide-line border-t border-line">
        <ChainRow chainId={mainnet.id} name="Ethereum" />
        <ChainRow chainId={base.id} name="Base" />
      </div>
    </section>
  );
}
