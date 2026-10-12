import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@w3s/db";
import type { EventParams, TransferParams } from "@w3s/db/schema";
import { addressUrl, getHeadBlock, networkBySlug } from "@w3s/explorer";
import { AddressGlyph } from "@/components/explorer/address-glyph";
import { TelegramIcon, WebhookIcon } from "@/components/monitors/channels";
import { DeleteMonitorButton, EnabledSwitch, TestAlertButton } from "@/components/monitors/monitor-controls";
import { AlertTimeline } from "@/components/monitors/timeline";
import { HourBars, NetworkChip, StatusPill } from "@/components/monitors/visuals";
import { requireOrg } from "@/lib/dal";
import { sinceNow } from "@/lib/format";
import { describeMonitor } from "@/lib/monitor-describe";
import { alertsHourly, getMonitor, monitorStats, recentAlerts } from "@/lib/monitoring";

export const metadata: Metadata = { title: "Monitor" };

export default function MonitorPage({ params }: PageProps<"/dashboard/monitors/[monitorId]">) {
  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <Link href="/dashboard/monitors" className="w-fit text-sm text-muted hover:text-ink">
        Monitors
      </Link>
      <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-line/30" />}>
        <Body params={params} />
      </Suspense>
    </div>
  );
}

async function Body({ params }: { params: Promise<{ monitorId: string }> }) {
  const { monitorId } = await params;
  const { org, can } = await requireOrg();
  const m = await getMonitor(org.id, monitorId);
  if (!m) notFound();
  const [alerts, channels, stats, hourly, head] = await Promise.all([
    recentAlerts(org.id, { monitorId: m.id, limit: 60 }),
    db
      .select({ id: schema.notificationChannel.id, name: schema.notificationChannel.name, kind: schema.notificationChannel.kind })
      .from(schema.notificationChannel)
      .where(and(eq(schema.notificationChannel.organizationId, org.id), isNull(schema.notificationChannel.disabledAt))),
    monitorStats(m.id),
    alertsHourly([m.id]),
    getHeadBlock(m.network),
  ]);
  const linked = channels.filter((c) => m.channelIds.includes(c.id));
  const net = networkBySlug(m.network);
  const p = m.params as TransferParams & EventParams;
  const finished = stats.delivered + stats.failed;
  const autoPaused = m.lastError?.startsWith("Paused automatically");
  const conditions: [string, React.ReactNode][] =
    m.kind === "event"
      ? [["Event", <span key="e" className="font-mono text-xs break-all">{p.signature}</span>]]
      : [
          ["Direction", p.direction === "in" ? "Incoming" : p.direction === "out" ? "Outgoing" : "Incoming and outgoing"],
          ["Asset", p.asset === "any" ? "Any coin or token" : p.asset === "native" ? `${net?.nativeSymbol ?? "Native"} only` : <span key="a" className="font-mono text-xs break-all">{p.asset}</span>],
          ["Minimum", p.minAmount ? Number(p.minAmount).toLocaleString("en") : "Any amount"],
        ];

  return (
    <>
      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className={m.enabled ? "" : "opacity-50 grayscale"}>
            <AddressGlyph address={m.address} className="size-16" />
          </span>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-3xl font-semibold tracking-[-0.02em]">{m.name}</h1>
              <StatusPill enabled={m.enabled} lastError={m.lastError} lastCheckedBlock={m.lastCheckedBlock} head={head} />
            </div>
            <p className="text-muted">{describeMonitor(m)}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
              <NetworkChip network={m.network} />
              {net ? (
                <a href={addressUrl(net, m.address)} target="_blank" rel="noreferrer" className="font-mono hover:text-ink hover:underline">
                  {m.address}
                </a>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {can({ monitor: ["update"] }) ? (
            <>
              <label className="flex items-center gap-2 text-sm text-muted">
                <EnabledSwitch id={m.id} enabled={m.enabled} />
                {m.enabled ? "On" : "Off"}
              </label>
              <Link href={`/dashboard/monitors/${m.id}/edit`} className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium hover:border-muted">
                Edit
              </Link>
            </>
          ) : null}
        </div>
      </header>

      {m.lastError ? (
        autoPaused ? (
          <p role="status" className="rounded-xl border border-amber/40 bg-amber-soft/60 px-4 py-3 text-sm">
            <span className="font-medium text-amber">Paused to protect your channels.</span>{" "}
            <span className="text-muted">It matched more than 200 times in an hour. Add a minimum amount or narrow the asset, then switch it back on.</span>
          </p>
        ) : (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm">
            <span className="font-medium text-danger">The last scan failed.</span> <span className="text-muted">{m.lastError}</span>
          </p>
        )
      ) : null}

      <section aria-label="Activity" className="grid grid-cols-2 items-end gap-6 rounded-xl border border-line bg-surface p-5 md:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        {[
          ["Alerts, 24h", String(stats.day)],
          ["Alerts, 7 days", String(stats.week)],
          ["Delivered, 7 days", finished ? `${Math.round((stats.delivered / finished) * 100)}%` : "n/a"],
          ["Checked up to", m.lastCheckedBlock ? `#${m.lastCheckedBlock.toLocaleString("en")}` : "next scan"],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1">
            <span className="text-xs text-muted">{k}</span>
            <span className="font-mono text-xl tabular-nums">{v}</span>
          </div>
        ))}
        <div className="col-span-2 md:col-span-1">
          <HourBars data={hourly.get(m.id) ?? []} label={m.name} />
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-labelledby="history" className="flex min-w-0 flex-col gap-4">
          <h2 id="history" className="text-lg font-semibold tracking-tight">
            Alert history
          </h2>
          <AlertTimeline alerts={alerts} showMonitor={false} empty="No alerts yet. Send a test to check that your channels receive them." />
        </section>
        <aside className="flex flex-col gap-6 lg:sticky lg:top-10 lg:self-start">
          <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
            <h2 className="font-semibold">Alerts when</h2>
            <dl className="flex flex-col gap-3 text-sm">
              {conditions.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted">Created</dt>
                <dd>{sinceNow(m.createdAt)}</dd>
              </div>
            </dl>
          </section>
          <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
            <h2 className="font-semibold">Delivers to</h2>
            {linked.length === 0 ? (
              <p className="text-sm text-muted">No channels. Alerts are only kept in the history.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {linked.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5 text-sm">
                    {c.kind === "telegram" ? <TelegramIcon className="size-5" /> : <WebhookIcon className="size-5 text-muted" />}
                    <span className="truncate">{c.name}</span>
                  </li>
                ))}
              </ul>
            )}
            {can({ monitor: ["update"] }) ? (
              <div className="border-t border-line pt-3">
                <TestAlertButton id={m.id} />
              </div>
            ) : null}
          </section>
          {can({ monitor: ["delete"] }) ? (
            <div className="flex justify-end">
              <DeleteMonitorButton id={m.id} name={m.name} />
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
