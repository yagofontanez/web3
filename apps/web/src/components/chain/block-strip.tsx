"use client";

import { useEffect, useState } from "react";
import { HashGlyph } from "./hash-glyph";
import { useLiveBlocks } from "./use-live-blocks";

function age(ts: number, now: number) {
  const s = Math.max(0, Math.round(now / 1000 - ts));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}

export function BlockStrip() {
  const { blocks } = useLiveBlocks();
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const placeholders = Math.max(0, 8 - blocks.length);

  return (
    <div className="relative">
      <div className="absolute top-[2.1rem] right-0 left-0 h-px bg-line sm:top-[2.6rem]" aria-hidden />
      <ol className="relative grid grid-cols-4 gap-x-3 gap-y-6 sm:grid-cols-8 sm:gap-x-4" aria-label="Latest blocks on Base">
        {blocks.map((b, i) => (
          <li key={b.number.toString()} className={`flex flex-col gap-2 ${i === 0 ? "block-in" : ""}`}>
            <div className={`rounded-md bg-paper p-1 ${i === 0 ? "ring-1 ring-verdigris" : ""}`}>
              <HashGlyph hash={b.hash} animate={false} gap={0.18} className="w-full" />
            </div>
            <div className="flex flex-col text-xs leading-tight">
              <span className="font-mono tabular-nums">{b.number.toLocaleString("en")}</span>
              <span className="text-muted">
                {b.txCount} txs{now ? `, ${age(b.timestamp, now)}` : ""}
              </span>
            </div>
          </li>
        ))}
        {Array.from({ length: placeholders }, (_, i) => (
          <li key={`p${i}`} className="flex flex-col gap-2">
            <div className="rounded-md bg-paper p-1">
              <HashGlyph animate={false} gap={0.18} className="w-full" />
            </div>
            <span className="h-8" />
          </li>
        ))}
      </ol>
    </div>
  );
}
