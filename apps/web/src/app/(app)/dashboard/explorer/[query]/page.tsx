import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db, schema } from "@w3s/db";
import { addressUrl, getActivity, getNfts, mainnets, networkBySlug, networks, type TokenHolding } from "@w3s/explorer";
import { ActivityList } from "@/components/explorer/activity-list";
import { AddressGlyph } from "@/components/explorer/address-glyph";
import { CopyButton } from "@/components/explorer/copy-button";
import { NftGrid } from "@/components/explorer/nft-grid";
import { RecordLookup } from "@/components/explorer/recent-lookups";
import { SaveAddress } from "@/components/explorer/saved-controls";
import { SearchForm } from "@/components/explorer/search-form";
import { NetworkPicker, Tabs } from "@/components/explorer/tabs";
import { TokenIcon } from "@/components/explorer/token-icon";
import { requireOrg } from "@/lib/dal";
import { ERROR_COPY, portfolioFor, resolveAddress } from "@/lib/explorer";
import { formatAmount, formatUsd } from "@/lib/format";

export const metadata: Metadata = { title: "Address" };

type Props = PageProps<"/dashboard/explorer/[query]">;
type Search = Awaited<Props["searchParams"]>;

const DUST_USD = 1;
const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const allNetworks = networks.map((n) => ({ slug: n.slug, name: n.name }));

export default function AddressPage({ params, searchParams }: Props) {
  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <Link href="/dashboard/explorer" className="w-fit text-sm text-muted hover:text-ink">
        Explorer
      </Link>
      <Suspense fallback={<HeaderSkeleton />}>
        <AddressBody params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AddressBody({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { query } = await params;
  const [resolved, { org, can }] = await Promise.all([resolveAddress(query), requireOrg()]);

  if (!resolved.ok) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {resolved.reason === "not_found" ? "That name doesn't point to an address" : "That isn't an address or a name"}
          </h1>
          <p className="text-sm text-muted">
            {resolved.reason === "not_found"
              ? `${decodeURIComponent(query)} has no address set in ENS. Check the spelling or paste the 0x address.`
              : "Addresses start with 0x and have 40 hex characters. Names look like vitalik.eth."}
          </p>
        </div>
        <SearchForm initial={decodeURIComponent(query)} />
      </div>
    );
  }

  const { address, ens } = resolved;
  const [saved] = await db
    .select({ label: schema.savedAddress.label })
    .from(schema.savedAddress)
    .where(and(eq(schema.savedAddress.organizationId, org.id), eq(schema.savedAddress.address, address)))
    .limit(1);

  return (
    <>
      <RecordLookup address={address} ens={ens} />
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <AddressGlyph address={address} className="size-16" />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{saved?.label ?? ens ?? "Wallet"}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="truncate font-mono text-sm text-muted">
                {saved && ens ? `${ens}, ` : ""}
                {address}
              </span>
              <CopyButton value={address} label="Copy address" />
              <a href={addressUrl(mainnets[0]!, address)} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-ink hover:underline">
                Etherscan
              </a>
            </div>
          </div>
        </div>
        {can({ address: ["create"] }) ? <SaveAddress address={address} ensName={ens} savedLabel={saved?.label ?? null} /> : null}
      </header>

      <Suspense fallback={<OverviewSkeleton />}>
        <Overview address={address} />
      </Suspense>

      <div className="flex flex-col gap-6">
        <Tabs />
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <TabContent address={address} searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function Overview({ address }: { address: string }) {
  const portfolio = await portfolioFor(address);
  const ranked = [...portfolio.byNetwork].sort((a, b) => b.totalUsd - a.totalUsd);
  const max = Math.max(...ranked.map((n) => n.totalUsd), 1);
  const failed = ranked.filter((n) => n.error);

  return (
    <section aria-labelledby="networth" className="grid gap-8 rounded-lg border border-line bg-surface p-6 lg:grid-cols-[auto_1fr] lg:gap-14">
      <div className="flex flex-col gap-1">
        <h2 id="networth" className="text-sm text-muted">
          Value across networks
        </h2>
        <p className="font-mono text-4xl tracking-tight tabular-nums">{formatUsd(portfolio.totalUsd)}</p>
        <p className="text-xs text-muted">Priced tokens only, refreshed every minute.</p>
      </div>
      <ul className="flex flex-col gap-2.5" aria-label="Value by network">
        {ranked.map((n) => {
          const net = networkBySlug(n.network)!;
          const pct = portfolio.totalUsd > 0 ? (n.totalUsd / portfolio.totalUsd) * 100 : 0;
          return (
            <li key={n.network} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm" title={`${net.name}: ${formatUsd(n.totalUsd)} (${pct.toFixed(1)}%)`}>
              <span className="truncate">{net.name}</span>
              <span className="h-2 overflow-hidden rounded-full bg-paper">
                <span
                  className="block h-full rounded-full bg-verdigris"
                  style={{ width: `${n.totalUsd > 0 ? Math.max(1.5, (n.totalUsd / max) * 100) : 0}%` }}
                />
              </span>
              <span className="w-24 text-right font-mono tabular-nums text-muted">
                {n.error ? "unavailable" : formatUsd(n.totalUsd, true)}
              </span>
            </li>
          );
        })}
      </ul>
      {failed.length > 0 ? (
        <p className="text-xs text-muted lg:col-span-2">
          Couldn&apos;t read {failed.map((f) => networkBySlug(f.network)!.name).join(", ")}. {ERROR_COPY[failed[0]!.error!]}
        </p>
      ) : null}
    </section>
  );
}

async function TabContent({ address, searchParams }: { address: string; searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const tab = pick(sp.tab) ?? "tokens";
  const requested = pick(sp.network);

  if (tab === "nfts" || tab === "activity") {
    const network = networkBySlug(requested) ?? mainnets[0]!;
    return (
      <div className="flex flex-col gap-5">
        <NetworkPicker networks={allNetworks} current={network.slug} allowAll={false} />
        {tab === "nfts" ? <NftsTab address={address} slug={network.slug} /> : <ActivityTab address={address} slug={network.slug} />}
      </div>
    );
  }

  const current = requested && networkBySlug(requested) && !networkBySlug(requested)!.testnet ? requested : "all";
  return (
    <div className="flex flex-col gap-5">
      <NetworkPicker networks={mainnets.map((n) => ({ slug: n.slug, name: n.name }))} current={current} allowAll />
      <TokensTab address={address} slug={current} />
    </div>
  );
}

async function TokensTab({ address, slug }: { address: string; slug: string }) {
  const portfolio = await portfolioFor(address);
  const scope = slug === "all" ? portfolio.byNetwork : portfolio.byNetwork.filter((n) => n.network === slug);
  const all = scope.flatMap((n) => n.holdings);
  const priced = all.filter((h) => h.valueUsd !== null).sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  const meaningful = priced.filter((h) => (h.valueUsd ?? 0) >= DUST_USD);
  const dust = priced.filter((h) => (h.valueUsd ?? 0) < DUST_USD);
  const unpriced = all.filter((h) => h.valueUsd === null);
  const truncated = scope.some((n) => n.truncated);
  const errors = scope.filter((n) => n.error);

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && slug !== "all" ? <p className="text-sm text-muted">{ERROR_COPY[errors[0]!.error!]}</p> : null}
      {priced.length === 0 ? (
        <p className="text-sm text-muted">No priced tokens{slug === "all" ? "" : " on this network"}.</p>
      ) : (
        <TokenTable rows={meaningful.length > 0 ? meaningful : priced} showNetwork={slug === "all"} />
      )}
      {meaningful.length > 0 && dust.length > 0 ? (
        <details className="group rounded-lg border border-dashed border-line">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm text-muted hover:text-ink">
            {dust.length.toLocaleString("en")} small balances under {formatUsd(DUST_USD)} worth {formatUsd(dust.reduce((sum, h) => sum + (h.valueUsd ?? 0), 0))} in total.
            <span className="ml-2 underline underline-offset-4 group-open:hidden">Show them</span>
          </summary>
          <div className="border-t border-dashed border-line">
            <TokenTable rows={dust} showNetwork={slug === "all"} muted />
          </div>
        </details>
      ) : null}
      {unpriced.length > 0 ? (
        <details className="group rounded-lg border border-dashed border-line">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm text-muted hover:text-ink">
            {unpriced.length.toLocaleString("en")} tokens without a market price are hidden. Most are unsolicited airdrops.
            <span className="ml-2 underline underline-offset-4 group-open:hidden">Show them</span>
          </summary>
          <div className="border-t border-dashed border-line">
            <TokenTable rows={unpriced.slice(0, 100)} showNetwork={slug === "all"} muted />
          </div>
        </details>
      ) : null}
      {truncated ? <p className="text-xs text-muted">This wallet holds more tokens than we scan. Showing the first 500 per network.</p> : null}
    </div>
  );
}

function TokenTable({ rows, showNetwork, muted = false }: { rows: TokenHolding[]; showNetwork: boolean; muted?: boolean }) {
  return (
    <div className={`overflow-x-auto ${muted ? "" : "rounded-lg border border-line bg-surface"}`}>
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="text-muted">
          <tr className="border-b border-line">
            <th className="px-4 py-2.5 font-medium">Token</th>
            {showNetwork ? <th className="px-4 py-2.5 font-medium">Network</th> : null}
            <th className="px-4 py-2.5 text-right font-medium">Balance</th>
            <th className="px-4 py-2.5 text-right font-medium">Price</th>
            <th className="px-4 py-2.5 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((h) => (
            <tr key={`${h.network}-${h.contract ?? "native"}`} className={muted ? "text-muted" : ""}>
              <td className="px-4 py-2.5">
                <span className="flex items-center gap-3">
                  <TokenIcon symbol={h.symbol} logo={muted ? null : h.logo} />
                  <span className="flex min-w-0 flex-col">
                    <span className="max-w-[14rem] truncate font-medium">{h.symbol}</span>
                    <span className="max-w-[14rem] truncate text-xs text-muted">{h.name}</span>
                  </span>
                </span>
              </td>
              {showNetwork ? <td className="px-4 py-2.5 text-muted">{networkBySlug(h.network)?.name}</td> : null}
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatAmount(h.balance)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-muted tabular-nums">{formatUsd(h.priceUsd)}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatUsd(h.valueUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function NftsTab({ address, slug }: { address: string; slug: string }) {
  const network = networkBySlug(slug)!;
  const page = await getNfts(address, network);
  if (page.error) return <p className="text-sm text-muted">{ERROR_COPY[page.error]}</p>;
  return <NftGrid key={slug} address={address} network={slug} initial={page} />;
}

async function ActivityTab({ address, slug }: { address: string; slug: string }) {
  const network = networkBySlug(slug)!;
  const page = await getActivity(address, network);
  if (page.error) return <p className="text-sm text-muted">{ERROR_COPY[page.error]}</p>;
  return <ActivityList key={slug} address={address} network={slug} explorerUrl={network.explorerUrl} initial={page} />;
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-4" aria-busy>
      <div className="size-16 animate-pulse rounded-md bg-line/60" />
      <div className="flex flex-col gap-2">
        <div className="h-6 w-48 animate-pulse rounded bg-line/60" />
        <div className="h-4 w-80 animate-pulse rounded bg-line/40" />
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return <div className="h-48 animate-pulse rounded-lg border border-line bg-surface" aria-busy />;
}
