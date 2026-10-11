"use client";

import { useState } from "react";
import type { NftPage } from "@w3s/explorer";
import { Button, FormError } from "../ui";

export function NftGrid({ address, network, initial }: { address: string; network: string; initial: NftPage }) {
  const [items, setItems] = useState(initial.items);
  const [spam, setSpam] = useState(initial.spamHidden);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/explorer/nfts?${new URLSearchParams({ address, network, cursor })}`);
      const page = (await res.json()) as NftPage;
      if (!res.ok || page.error) throw new Error();
      setItems((prev) => [...prev, ...page.items]);
      setSpam((s) => s + page.spamHidden);
      setCursor(page.nextCursor);
    } catch {
      setError("Couldn't load more NFTs. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {spam > 0 ? <p className="text-sm text-muted">{spam.toLocaleString("en")} NFTs flagged as spam are hidden.</p> : null}
      {items.length === 0 ? (
        <p className="text-sm text-muted">{cursor ? "No legitimate NFTs in the first batch. Keep scanning." : "No NFTs on this network."}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((n) => (
            <li key={`${n.contract}-${n.tokenId}`} className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
              <div className="aspect-square bg-paper">
                {n.image ? (
                  <img src={n.image} alt={n.name} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-xs text-muted">No image</div>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 p-3">
                <span className="truncate text-sm font-medium" title={n.name}>
                  {n.name}
                </span>
                <span className="truncate text-xs text-muted">
                  {n.collection ?? "Unknown collection"}
                  {n.balance !== "1" ? `, ×${n.balance}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormError message={error} />
      {cursor ? (
        <Button variant="secondary" onClick={loadMore} disabled={loading} className="self-start">
          {loading ? "Scanning…" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
