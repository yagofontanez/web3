import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db, schema } from "@w3s/db";
import { AddressGlyph } from "@/components/explorer/address-glyph";
import { RemoveSaved } from "@/components/explorer/saved-controls";
import { SearchForm } from "@/components/explorer/search-form";
import { requireOrg } from "@/lib/dal";

export const metadata: Metadata = { title: "Explorer" };

export default function ExplorerPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Explorer</h1>
        <p className="max-w-[62ch] text-sm text-muted">
          Balances, tokens, NFTs and activity for any wallet across Ethereum, Base, Polygon, Arbitrum and Optimism.
        </p>
      </header>
      <SearchForm autoFocus />
      <Suspense fallback={<p className="text-sm text-muted">Loading saved addresses…</p>}>
        <SavedAddresses />
      </Suspense>
    </div>
  );
}

async function SavedAddresses() {
  const { org, can } = await requireOrg();
  const rows = await db
    .select()
    .from(schema.savedAddress)
    .where(eq(schema.savedAddress.organizationId, org.id))
    .orderBy(desc(schema.savedAddress.createdAt));
  const canRemove = can({ address: ["delete"] });

  return (
    <section aria-labelledby="saved" className="flex flex-col gap-3">
      <h2 id="saved" className="text-lg font-semibold tracking-tight">
        Saved by {org.name}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing saved yet. Look up a wallet and save it to keep it here for your whole team.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <AddressGlyph address={r.address} className="size-9" />
              <Link href={`/dashboard/explorer/${r.address}`} className="flex min-w-0 flex-1 flex-col hover:underline">
                <span className="truncate font-medium">{r.label}</span>
                <span className="truncate font-mono text-xs text-muted">{r.ensName ?? r.address}</span>
              </Link>
              {canRemove ? <RemoveSaved id={r.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
