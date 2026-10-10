"use client";

import { HashGlyph } from "./hash-glyph";
import { useLiveBlocks, type LiveBlock } from "./use-live-blocks";

function blockSentence(b: LiveBlock) {
  return `${b.txCount.toLocaleString("en")} transactions, gas ${Math.round(b.gasPct)}% full.`;
}

export function LatestGlyph({ className = "" }: { className?: string }) {
  const { latest } = useLiveBlocks();
  return (
    <HashGlyph
      hash={latest?.hash}
      className={className}
      label={latest ? `Pattern drawn from the hash of Base block ${latest.number}` : undefined}
    />
  );
}

export function LatestCaption({ tagline }: { tagline: string }) {
  const { latest, error } = useLiveBlocks();
  return (
    <p className="flex flex-col gap-1 text-sm">
      {latest ? (
        <>
          <span>
            Base block <span className="font-mono tabular-nums">{latest.number.toLocaleString("en")}</span>, drawn from its
            hash.
          </span>
          <span className="text-muted">
            {blockSentence(latest)} {tagline}
          </span>
        </>
      ) : (
        <span className="text-muted">{error ? "Base is not responding right now." : "Reading the latest block on Base…"}</span>
      )}
    </p>
  );
}

export function MiniChain() {
  const { blocks } = useLiveBlocks();
  return (
    <ol className="flex items-center gap-2.5" aria-label="Previous blocks">
      {blocks.slice(1).map((b, i) => (
        <li
          key={b.number.toString()}
          className={`w-11 ${i === 0 ? "block-in" : ""}`}
          style={{ opacity: 1 - i * 0.14 }}
          title={`Block ${b.number}`}
        >
          <HashGlyph hash={b.hash} gap={0.24} animate={false} className="w-full" />
        </li>
      ))}
    </ol>
  );
}

export function LiveGlyph() {
  return (
    <figure className="flex w-full max-w-[26rem] flex-col gap-5">
      <LatestGlyph className="w-full" />
      <figcaption>
        <LatestCaption tagline="A new one lands every two seconds." />
      </figcaption>
    </figure>
  );
}
