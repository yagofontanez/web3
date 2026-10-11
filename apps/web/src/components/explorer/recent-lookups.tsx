"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { AddressGlyph } from "./address-glyph";
import { clearRecent, pushRecent, readRecent, type RecentLookup } from "./recent";

let cache: { raw: string; value: RecentLookup[] } = { raw: "", value: [] };

function snapshot() {
  const value = readRecent();
  const raw = JSON.stringify(value);
  if (raw !== cache.raw) cache = { raw, value };
  return cache.value;
}

const empty: RecentLookup[] = [];

function subscribe(onChange: () => void) {
  window.addEventListener("w3s:recent", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("w3s:recent", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function RecordLookup({ address, ens }: { address: string; ens: string | null }) {
  useEffect(() => pushRecent({ address, ens }), [address, ens]);
  return null;
}

export function RecentLookups() {
  const items = useSyncExternalStore(subscribe, snapshot, () => empty);

  return (
    <section aria-labelledby="recent" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="recent" className="font-semibold">
          Recently viewed
        </h2>
        {items.length > 0 ? (
          <button type="button" onClick={clearRecent} className="text-xs text-muted hover:text-ink">
            Clear
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Wallets you open show up here. Only you can see this list.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((r) => (
            <li key={r.address}>
              <Link href={`/dashboard/explorer/${r.address}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface">
                <AddressGlyph address={r.address} className="size-7" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{r.ens ?? `${r.address.slice(0, 6)}…${r.address.slice(-4)}`}</span>
                  {r.ens ? <span className="truncate font-mono text-xs text-muted">{`${r.address.slice(0, 6)}…${r.address.slice(-4)}`}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
