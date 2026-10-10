"use client";

import { useBlockNumber } from "wagmi";
import { base, mainnet } from "wagmi/chains";

function Row({ chainId, name, cadence }: { chainId: number; name: string; cadence: string }) {
  const { data, isError } = useBlockNumber({ chainId: chainId as typeof mainnet.id, watch: true });
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-line py-4 last:border-b-0">
      <div className="flex flex-col">
        <span className="font-medium">{name}</span>
        <span className="text-xs text-muted">new block {cadence}</span>
      </div>
      <span className="font-mono text-2xl tabular-nums sm:text-4xl" aria-live="off">
        {isError ? "unreachable" : data ? data.toLocaleString("en") : "…"}
      </span>
    </div>
  );
}

export function LiveBlocks() {
  return (
    <div className="rounded-lg border border-line bg-surface px-5">
      <Row chainId={mainnet.id} name="Ethereum" cadence="every ~12s" />
      <Row chainId={base.id} name="Base" cadence="every ~2s" />
    </div>
  );
}
