"use client";

import { useEffect, useState } from "react";
import type { ActivityItem, ActivityPage } from "@w3s/explorer";
import { formatAmount, timeAgo } from "@/lib/format";
import { Button, FormError, shortAddress } from "../ui";

const CATEGORY: Record<string, string> = {
  external: "Transfer",
  internal: "Internal transfer",
  erc20: "Token transfer",
  erc721: "NFT transfer",
  erc1155: "NFT transfer",
};

function Arrow({ direction }: { direction: ActivityItem["direction"] }) {
  const label = direction === "in" ? "Received" : direction === "out" ? "Sent" : "Self";
  return (
    <span
      className={`grid size-8 shrink-0 place-items-center rounded-full text-sm ${direction === "in" ? "bg-verdigris-soft text-verdigris" : "bg-paper text-muted ring-1 ring-line"}`}
      title={label}
      aria-label={label}
    >
      {direction === "in" ? "↓" : direction === "out" ? "↑" : "↻"}
    </span>
  );
}

export function ActivityList({
  address,
  network,
  explorerUrl,
  initial,
}: {
  address: string;
  network: string;
  explorerUrl: string;
  initial: ActivityPage;
}) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [showUnverified, setShowUnverified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ address, network, cursor });
      const res = await fetch(`/api/explorer/activity?${qs}`);
      const page = (await res.json()) as ActivityPage;
      if (!res.ok || page.error) throw new Error();
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))].sort((a, b) => b.blockNumber - a.blockNumber);
      });
      setCursor(page.nextCursor);
    } catch {
      setError("Couldn't load older activity. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const hidden = items.filter((i) => !i.verified).length;
  const visible = showUnverified ? items : items.filter((i) => i.verified);

  return (
    <div className="flex flex-col gap-4">
      {hidden > 0 ? (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showUnverified} onChange={(e) => setShowUnverified(e.target.checked)} className="accent-[var(--verdigris)]" />
          Show {hidden} transfers of unverified tokens (usually unsolicited airdrops)
        </label>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-sm text-muted">
          {items.length === 0 ? "No activity on this network yet." : "Only unverified token transfers in this range."}
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {visible.map((i) => (
            <li key={i.id} className={`flex items-center gap-3 px-4 py-3 ${i.verified ? "" : "opacity-60"}`}>
              <Arrow direction={i.direction} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">
                  <span className="font-medium">{CATEGORY[i.category] ?? i.category}</span>
                  {i.counterparty ? (
                    <span className="text-muted">
                      {" "}
                      {i.direction === "out" ? "to" : "from"} <span className="font-mono">{shortAddress(i.counterparty)}</span>
                    </span>
                  ) : null}
                </span>
                <a
                  href={`${explorerUrl}/tx/${i.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-fit font-mono text-xs text-muted hover:text-ink hover:underline"
                >
                  {i.hash.slice(0, 10)}…{now ? `, ${timeAgo(i.timestamp, now)}` : ""}
                </a>
              </div>
              <span className={`shrink-0 text-right font-mono text-sm tabular-nums ${i.direction === "in" ? "text-verdigris" : ""}`}>
                {i.direction === "in" ? "+" : i.direction === "out" ? "−" : ""}
                {i.category === "erc721" ? `#${i.tokenId ? BigInt(i.tokenId).toString().slice(0, 8) : "?"}` : formatAmount(i.value)}{" "}
                <span className="text-muted">{i.asset ?? ""}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <FormError message={error} />
      {cursor ? (
        <Button variant="secondary" onClick={loadMore} disabled={loading} className="self-start">
          {loading ? "Loading…" : "Load older activity"}
        </Button>
      ) : items.length > 0 ? (
        <p className="text-xs text-muted">That&apos;s the full history on this network.</p>
      ) : null}
    </div>
  );
}
