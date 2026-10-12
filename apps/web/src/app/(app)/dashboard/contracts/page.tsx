import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@w3s/db";
import { AddressGlyph } from "@/components/explorer/address-glyph";
import { NetworkChip } from "@/components/monitors/visuals";
import { requireOrg } from "@/lib/dal";
import { sinceNow } from "@/lib/format";

export const metadata: Metadata = { title: "Contract studio" };

const STARTS = [
  { href: "/dashboard/contracts/new?type=erc20", title: "Token", tag: "ERC-20", body: "Points, credits or a currency, with optional minting, burning, pausing and permit." },
  { href: "/dashboard/contracts/new?type=erc721", title: "NFT collection", tag: "ERC-721", body: "Passes, badges or collectibles with sequential ids and a base URI." },
  { href: "/dashboard/contracts/new?type=custom", title: "Your own Solidity", tag: "Custom", body: "Paste any contract. OpenZeppelin imports resolve automatically." },
  { href: "/dashboard/contracts/import", title: "Import a deployed contract", tag: "Import", body: "Bring in any verified contract by address and call it from here." },
];

export default function ContractsPage() {
  return (
    <div className="flex max-w-6xl flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">Contract studio</h1>
        <p className="max-w-[64ch] text-muted">
          Start from audited OpenZeppelin templates, deploy to a testnet from your own wallet, and call any function from the browser. Your keys never leave your wallet.
        </p>
      </header>
      <section aria-labelledby="start" className="flex flex-col gap-4">
        <h2 id="start" className="text-lg font-semibold tracking-tight">
          Start something
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STARTS.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="group flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-4 hover:border-muted">
                <span className="w-fit rounded bg-paper px-1.5 py-0.5 font-mono text-[11px] text-muted ring-1 ring-line">{s.tag}</span>
                <span className="flex flex-col gap-1">
                  <span className="font-semibold group-hover:underline">{s.title}</span>
                  <span className="text-xs leading-relaxed text-muted">{s.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl border border-line bg-surface" />}>
        <ContractList />
      </Suspense>
    </div>
  );
}

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-paper text-muted ring-1 ring-line" },
  deploying: { label: "Deploying", tone: "bg-amber-soft text-amber" },
  deployed: { label: "Deployed", tone: "bg-verdigris-soft text-verdigris" },
  failed: { label: "Deploy failed", tone: "bg-danger/10 text-danger" },
};

async function ContractList() {
  const { org } = await requireOrg();
  const rows = await db
    .select({
      id: schema.studioContract.id,
      name: schema.studioContract.name,
      contractName: schema.studioContract.contractName,
      origin: schema.studioContract.origin,
      status: schema.studioContract.status,
      network: schema.studioContract.network,
      address: schema.studioContract.address,
      verification: schema.studioContract.verification,
      updatedAt: schema.studioContract.updatedAt,
    })
    .from(schema.studioContract)
    .where(eq(schema.studioContract.organizationId, org.id))
    .orderBy(desc(schema.studioContract.updatedAt));

  return (
    <section aria-labelledby="yours" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="yours" className="text-lg font-semibold tracking-tight">
          {org.name}&apos;s contracts
        </h2>
        {rows.length ? <span className="text-sm text-muted">{rows.length === 1 ? "1 contract" : `${rows.length} contracts`}</span> : null}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">Nothing here yet. Compile a template above, or import a contract that&apos;s already deployed.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {rows.map((r) => {
            const s = STATUS[r.status]!;
            return (
              <li key={r.id}>
                <Link href={`/dashboard/contracts/${r.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-paper/50">
                  {r.address ? (
                    <AddressGlyph address={r.address} className="size-11" />
                  ) : (
                    <span className="grid size-11 shrink-0 place-items-center rounded-md border border-dashed border-line font-mono text-xs text-muted" aria-hidden>
                      .sol
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{r.name}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${s.tone}`}>{s.label}</span>
                      {r.verification === "verified" ? <span className="rounded px-1.5 py-0.5 text-[11px] text-verdigris ring-1 ring-verdigris/30">Verified</span> : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="font-mono">{r.contractName}</span>
                      {r.network === "local" ? <span className="rounded-full border border-line px-2 py-0.5 text-[11px]">Local devnet</span> : r.network ? <NetworkChip network={r.network} /> : null}
                      {r.address ? <span className="font-mono">{r.address.slice(0, 6)}…{r.address.slice(-4)}</span> : null}
                      <span>{r.origin === "imported" ? "imported" : r.origin === "template" ? "from template" : "custom source"}</span>
                      <span>updated {sinceNow(r.updatedAt)}</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
