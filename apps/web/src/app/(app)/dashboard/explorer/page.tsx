import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db, schema } from "@w3s/db";
import { mainnets } from "@w3s/explorer";
import { AddressGlyph } from "@/components/explorer/address-glyph";
import { RecentLookups } from "@/components/explorer/recent-lookups";
import { RemoveSaved } from "@/components/explorer/saved-controls";
import { SmartSearch } from "@/components/explorer/smart-search";
import { requireOrg } from "@/lib/dal";
import { portfolioFor } from "@/lib/explorer";
import { formatUsd, sinceNow } from "@/lib/format";

export const metadata: Metadata = { title: "Explorer" };

export default function ExplorerPage() {
  return (
    <div className="flex max-w-6xl flex-col gap-12">
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">Explorer</h1>
          <p className="max-w-[60ch] text-muted">
            Look up any wallet to see what it holds and what it has been doing, on five networks at once.
          </p>
        </div>
        <SmartSearch />
      </section>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Suspense fallback={<SavedSkeleton />}>
          <SavedAddresses />
        </Suspense>
        <aside className="flex flex-col gap-10">
          <RecentLookups />
          <Coverage />
        </aside>
      </div>
    </div>
  );
}

async function SavedAddresses() {
  const { org, can } = await requireOrg();
  const rows = await db
    .select({
      id: schema.savedAddress.id,
      address: schema.savedAddress.address,
      label: schema.savedAddress.label,
      ensName: schema.savedAddress.ensName,
      createdAt: schema.savedAddress.createdAt,
      savedBy: schema.user.name,
    })
    .from(schema.savedAddress)
    .leftJoin(schema.user, eq(schema.savedAddress.createdBy, schema.user.id))
    .where(eq(schema.savedAddress.organizationId, org.id))
    .orderBy(desc(schema.savedAddress.createdAt));
  const canRemove = can({ address: ["delete"] });

  return (
    <section aria-labelledby="saved" className="flex min-w-0 flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="saved" className="text-lg font-semibold tracking-tight">
          Saved by {org.name}
        </h2>
        {rows.length > 0 ? <span className="text-sm text-muted">{rows.length === 1 ? "1 wallet" : `${rows.length} wallets`}</span> : null}
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-line p-6">
          <p className="font-medium">No saved wallets yet</p>
          <p className="max-w-[56ch] text-sm text-muted">
            Open a wallet and choose Save address. It shows up here for everyone in {org.name}, and on the overview with its
            value.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id} className="group flex items-center gap-4 px-4 py-3.5 hover:bg-paper/50">
              <AddressGlyph address={r.address} className="size-11" />
              <Link href={`/dashboard/explorer/${r.address}`} className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium group-hover:underline">{r.label}</span>
                <span className="truncate text-xs text-muted">
                  <span className="font-mono">{r.ensName ?? `${r.address.slice(0, 8)}…${r.address.slice(-6)}`}</span>
                  {r.savedBy ? `, saved by ${r.savedBy} ${sinceNow(r.createdAt)}` : ""}
                </span>
              </Link>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <Suspense fallback={<span className="h-5 w-20 animate-pulse rounded bg-line/50" />}>
                  <SavedValue address={r.address} />
                </Suspense>
                {canRemove ? (
                  <span className="text-xs transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <RemoveSaved id={r.id} />
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function SavedValue({ address }: { address: string }) {
  const p = await portfolioFor(address);
  return <span className="shrink-0 font-mono text-sm tabular-nums">{formatUsd(p.totalUsd)}</span>;
}

function Coverage() {
  return (
    <section aria-labelledby="coverage" className="flex flex-col gap-3">
      <h2 id="coverage" className="font-semibold">
        What the explorer reads
      </h2>
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="pb-2 font-normal">Network</th>
            <th className="pb-2 text-center font-normal">Tokens</th>
            <th className="pb-2 text-center font-normal">NFTs</th>
            <th className="pb-2 text-center font-normal">Activity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line border-t border-line">
          {mainnets.map((n) => (
            <tr key={n.slug}>
              <td className="py-2">{n.name}</td>
              {[0, 1, 2].map((i) => (
                <td key={i} className="py-2 text-center text-verdigris" aria-label="Supported">
                  ✓
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted">Sepolia and Base Sepolia are available for NFTs and activity. Prices refresh every minute.</p>
    </section>
  );
}

function SavedSkeleton() {
  return (
    <section className="flex flex-col gap-4" aria-busy>
      <h2 className="text-lg font-semibold tracking-tight">Saved wallets</h2>
      <div className="h-48 animate-pulse rounded-xl border border-line bg-surface" />
    </section>
  );
}
