import { and, count, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db, schema } from "@w3s/db";
import { networkBySlug } from "@w3s/explorer";
import { NetworkPulse } from "@/components/dashboard/network-pulse";
import { AddressGlyph } from "@/components/explorer/address-glyph";
import { SearchForm } from "@/components/explorer/search-form";
import { Icon } from "@/components/icons";
import { OrgGlyph } from "@/components/org-glyph";
import { requireOrg } from "@/lib/dal";
import { portfolioFor } from "@/lib/explorer";
import { formatUsd, isWithin, sinceNow } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

const WATCH_LIMIT = 6;

export default function OverviewPage() {
  return (
    <div className="flex max-w-6xl flex-col gap-10">
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>

      <Suspense>
        <Setup />
      </Suspense>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-10">
          <Suspense fallback={<SectionSkeleton title="Watched wallets" />}>
            <WatchedWallets />
          </Suspense>
          <Suspense fallback={<SectionSkeleton title="Team activity" />}>
            <TeamActivity />
          </Suspense>
        </div>
        <div className="flex min-w-0 flex-col gap-10">
          <NetworkPulse />
          <Suspense fallback={<SectionSkeleton title="Team" />}>
            <Team />
          </Suspense>
        </div>
      </div>

      <ComingNext />
    </div>
  );
}

async function Header() {
  const { org, user, role } = await requireOrg();
  const firstName = user.name?.split(" ")[0];
  const isNew = isWithin(user.createdAt, 60 * 60 * 1000);
  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex items-center gap-4">
        <OrgGlyph id={org.id} className="size-14" />
        <div className="flex flex-col gap-0.5">
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">{org.name}</h1>
          <p className="text-sm text-muted">
            {firstName ? `${isNew ? "Welcome" : "Welcome back"}, ${firstName}. ` : ""}You&apos;re {role === "owner" || role === "admin" ? "an" : "a"} {role} here.
          </p>
        </div>
      </div>
      <div className="w-full lg:max-w-md">
        <SearchForm compact />
      </div>
    </header>
  );
}

async function Setup() {
  const { org, can } = await requireOrg();
  const [{ saved }] = (await db
    .select({ saved: count() })
    .from(schema.savedAddress)
    .where(eq(schema.savedAddress.organizationId, org.id))) as [{ saved: number }];
  const invited = org.members.length > 1 || org.invitations.some((i) => i.status === "pending");

  const steps = [
    { done: true, title: "Create your organization", body: `${org.name} is ready.`, href: null },
    {
      done: saved > 0,
      title: "Watch your first wallet",
      body: can({ address: ["create"] }) ? "Look up a treasury or hot wallet and save it." : "An admin or developer can save wallets.",
      href: "/dashboard/explorer",
    },
    {
      done: invited,
      title: "Bring in your team",
      body: can({ invitation: ["create"] }) ? "Invite a teammate and pick their role." : "Ask an admin to invite your teammates.",
      href: "/dashboard/settings",
    },
  ];
  if (steps.every((s) => s.done)) return null;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section aria-labelledby="setup" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="setup" className="font-semibold">
          Get your workspace ready
        </h2>
        <span className="text-sm text-muted">
          {doneCount} of {steps.length} done
        </span>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => {
          const inner = (
            <>
              <span
                aria-hidden
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  s.done ? "bg-verdigris text-white" : "bg-paper text-muted ring-1 ring-line"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className={`text-sm font-medium ${s.done ? "text-muted line-through decoration-line" : ""}`}>{s.title}</span>
                <span className="text-xs text-muted">{s.body}</span>
              </span>
            </>
          );
          return (
            <li key={s.title}>
              {s.href && !s.done ? (
                <Link href={s.href} className="flex gap-3 rounded-lg p-2 -m-2 hover:bg-paper">
                  {inner}
                </Link>
              ) : (
                <div className="flex gap-3">{inner}</div>
              )}
              <span className="sr-only">{s.done ? "Done" : "Not done"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

async function WatchedWallets() {
  const { org } = await requireOrg();
  const rows = await db
    .select()
    .from(schema.savedAddress)
    .where(eq(schema.savedAddress.organizationId, org.id))
    .orderBy(desc(schema.savedAddress.createdAt))
    .limit(WATCH_LIMIT);
  const [{ total }] = (await db
    .select({ total: count() })
    .from(schema.savedAddress)
    .where(eq(schema.savedAddress.organizationId, org.id))) as [{ total: number }];

  return (
    <section aria-labelledby="watched" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="watched" className="text-lg font-semibold tracking-tight">
            Watched wallets
          </h2>
          {rows.length > 0 ? (
            <Suspense fallback={<span className="h-8 w-40 animate-pulse rounded bg-line/50" />}>
              <WatchedTotal addresses={rows.map((r) => r.address)} />
            </Suspense>
          ) : null}
        </div>
        <Link href="/dashboard/explorer" className="text-sm text-muted hover:text-ink">
          {total > rows.length ? `All ${total} wallets` : "Open explorer"}
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line p-6">
          <p className="max-w-[52ch] text-sm text-muted">
            Wallets your team saves from the explorer show up here with their value across every network.
          </p>
          <Link href="/dashboard/explorer/vitalik.eth" className="text-sm font-medium underline underline-offset-4">
            Try it with vitalik.eth
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/dashboard/explorer/${r.address}`} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-paper/60">
                <AddressGlyph address={r.address} className="size-10" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{r.label}</span>
                  <span className="truncate font-mono text-xs text-muted">{r.ensName ?? `${r.address.slice(0, 8)}…${r.address.slice(-6)}`}</span>
                </span>
                <Suspense fallback={<span className="h-5 w-24 animate-pulse rounded bg-line/50" />}>
                  <WalletValue address={r.address} />
                </Suspense>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function WatchedTotal({ addresses }: { addresses: string[] }) {
  const portfolios = await Promise.all(addresses.map((a) => portfolioFor(a)));
  const total = portfolios.reduce((sum, p) => sum + p.totalUsd, 0);
  return (
    <p className="flex items-baseline gap-2">
      <span className="font-mono text-2xl tracking-tight tabular-nums">{formatUsd(total)}</span>
      <span className="text-xs text-muted">across {addresses.length === 1 ? "1 wallet" : `${addresses.length} wallets`}</span>
    </p>
  );
}

async function WalletValue({ address }: { address: string }) {
  const p = await portfolioFor(address);
  const top = [...p.byNetwork].sort((a, b) => b.totalUsd - a.totalUsd)[0];
  const share = top && p.totalUsd > 0 ? top.totalUsd / p.totalUsd : 0;
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <span className="font-mono text-sm tabular-nums">{formatUsd(p.totalUsd)}</span>
      {top && p.totalUsd > 0 ? (
        <span className="flex items-center gap-1.5 text-xs text-muted" title={`${Math.round(share * 100)}% on ${networkBySlug(top.network)?.name}`}>
          <span className="h-1 w-12 overflow-hidden rounded-full bg-paper">
            <span className="block h-full rounded-full bg-verdigris" style={{ width: `${Math.max(6, share * 100)}%` }} />
          </span>
          mostly {networkBySlug(top.network)?.name}
        </span>
      ) : (
        <span className="text-xs text-muted">empty</span>
      )}
    </span>
  );
}

function describe(action: string, meta: Record<string, unknown> | null): string {
  const m = meta ?? {};
  switch (action) {
    case "organization.created":
      return "created the organization";
    case "invitation.created":
      return `invited ${m.email ?? "someone"} as ${m.role ?? "a member"}`;
    case "invitation.accepted":
      return "joined the organization";
    case "member.role_updated":
      return `changed a role from ${m.from} to ${m.to}`;
    case "member.removed":
      return `removed ${m.email ?? "a member"}`;
    case "address.saved":
      return `saved ${m.label ?? "a wallet"}`;
    case "address.removed":
      return `stopped watching ${m.label ?? "a wallet"}`;
    default:
      return action;
  }
}

async function TeamActivity() {
  const { org, can } = await requireOrg();
  const rows = await db
    .select({
      id: schema.auditLog.id,
      action: schema.auditLog.action,
      metadata: schema.auditLog.metadata,
      createdAt: schema.auditLog.createdAt,
      actorName: schema.user.name,
      actorEmail: schema.user.email,
    })
    .from(schema.auditLog)
    .leftJoin(schema.user, eq(schema.auditLog.actorId, schema.user.id))
    .where(and(eq(schema.auditLog.organizationId, org.id)))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(7);

  return (
    <section aria-labelledby="activity" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <h2 id="activity" className="text-lg font-semibold tracking-tight">
          Team activity
        </h2>
        {can({ audit: ["read"] }) ? (
          <Link href="/dashboard/settings" className="text-sm text-muted hover:text-ink">
            Full audit log
          </Link>
        ) : null}
      </div>
      <ol className="relative flex flex-col">
        <span aria-hidden className="absolute top-5 bottom-5 left-[11px] w-px bg-line" />
        {rows.map((r, i) => (
          <li key={r.id} className="relative flex gap-4 py-2.5">
            <span
              aria-hidden
              className={`relative z-10 mt-1 size-[9px] shrink-0 translate-x-[7px] rounded-full ring-4 ring-paper ${i === 0 ? "bg-verdigris" : "bg-muted/50"}`}
            />
            <p className="ml-1 flex-1 text-sm">
              <span className="font-medium">{r.actorName || r.actorEmail || "Someone"}</span>{" "}
              <span className="text-muted">{describe(r.action, r.metadata)}</span>
            </p>
            <time className="shrink-0 text-xs text-muted" dateTime={r.createdAt.toISOString()}>
              {sinceNow(r.createdAt)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}

async function Team() {
  const { org, user, can } = await requireOrg();
  const pending = org.invitations.filter((i) => i.status === "pending");
  const shown = org.members.slice(0, 5);
  return (
    <section aria-labelledby="team" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <h2 id="team" className="text-lg font-semibold tracking-tight">
          Team
        </h2>
        <Link href="/dashboard/settings" className="text-sm text-muted hover:text-ink">
          {can({ invitation: ["create"] }) ? "Invite" : "Members"}
        </Link>
      </div>
      <ul className="flex flex-col gap-3">
        {shown.map((m) => {
          const name = m.user.name || m.user.email;
          return (
            <li key={m.id} className="flex items-center gap-3">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-xs font-semibold ring-1 ring-line">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {name}
                  {m.userId === user.id ? <span className="font-normal text-muted"> (you)</span> : null}
                </span>
              </span>
              <span className="text-xs text-muted capitalize">{m.role}</span>
            </li>
          );
        })}
      </ul>
      {org.members.length > shown.length || pending.length > 0 ? (
        <p className="text-xs text-muted">
          {org.members.length > shown.length ? `${org.members.length - shown.length} more members. ` : ""}
          {pending.length > 0 ? `${pending.length} ${pending.length === 1 ? "invitation is" : "invitations are"} waiting to be accepted.` : ""}
        </p>
      ) : null}
    </section>
  );
}

function ComingNext() {
  const items = [
    { icon: "api" as const, name: "API & keys", text: "Serve this data to your own apps." },
    { icon: "monitors" as const, name: "Monitors", text: "Telegram and webhook alerts on watched wallets." },
    { icon: "contracts" as const, name: "Contract studio", text: "Deploy templates to testnets from your wallet." },
  ];
  return (
    <section aria-labelledby="next" className="flex flex-col gap-4 border-t border-line pt-8">
      <h2 id="next" className="text-sm font-medium text-muted">
        Coming to this workspace
      </h2>
      <ul className="grid gap-6 sm:grid-cols-3">
        {items.map((i) => (
          <li key={i.name} className="flex gap-3">
            <Icon name={i.icon} className="mt-0.5 shrink-0 text-muted" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{i.name}</span>
              <span className="text-sm text-muted">{i.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-4" aria-busy>
      <div className="size-14 animate-pulse rounded-md bg-line/60" />
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 animate-pulse rounded bg-line/60" />
        <div className="h-4 w-64 animate-pulse rounded bg-line/40" />
      </div>
    </div>
  );
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <section className="flex flex-col gap-4" aria-busy>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="h-40 animate-pulse rounded-xl border border-line bg-surface" />
    </section>
  );
}
