import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getHeadBlock } from "@w3s/explorer";
import { AddressGlyph } from "@/components/explorer/address-glyph";
import { AddWebhook, ChannelActions, ConnectTelegram, TelegramIcon, WebhookIcon } from "@/components/monitors/channels";
import { EnabledSwitch } from "@/components/monitors/monitor-controls";
import { AlertTimeline } from "@/components/monitors/timeline";
import { HourBars, KindIcon, NetworkChip, StatusPill, syncState } from "@/components/monitors/visuals";
import { requireOrg } from "@/lib/dal";
import { sinceNow } from "@/lib/format";
import { MONITOR_TEMPLATES } from "@/lib/monitor-templates";
import { describeMonitor } from "@/lib/monitor-describe";
import { alertsHourly, listChannels, listMonitors, monitoringSummary, recentAlerts } from "@/lib/monitoring";

export const metadata: Metadata = { title: "Monitors" };

export default function MonitorsPage() {
  return (
    <div className="flex max-w-6xl flex-col gap-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">Monitors</h1>
          <p className="max-w-[62ch] text-muted">Watch wallets and contracts on every network and hear about it the moment something moves, in Telegram or on your own servers.</p>
        </div>
        <Suspense>
          <NewIfAllowed />
        </Suspense>
      </header>
      <Suspense fallback={<div className="h-24 animate-pulse rounded-xl border border-line bg-surface" />}>
        <Summary />
      </Suspense>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-12">
          <Suspense fallback={<div className="h-56 animate-pulse rounded-xl border border-line bg-surface" />}>
            <MonitorList />
          </Suspense>
          <Suspense fallback={<div className="h-56 animate-pulse rounded-xl border border-line bg-surface" />}>
            <RecentAlerts />
          </Suspense>
        </div>
        <Suspense fallback={<div className="h-56 animate-pulse rounded-xl border border-line bg-surface" />}>
          <Channels />
        </Suspense>
      </div>
    </div>
  );
}

async function NewIfAllowed() {
  const { can } = await requireOrg();
  if (!can({ monitor: ["create"] })) return null;
  return (
    <Link href="/dashboard/monitors/new" className="inline-flex h-9 shrink-0 items-center rounded-md bg-ink px-4 text-sm font-medium text-paper hover:opacity-90">
      New monitor
    </Link>
  );
}

async function Summary() {
  const { org } = await requireOrg();
  const s = await monitoringSummary(org.id);
  const finished = s.deliveries.delivered + s.deliveries.failed;
  const rate = finished ? (s.deliveries.delivered / finished) * 100 : null;
  const items: { label: string; value: string; sub: string; tone?: "warn" }[] = [
    { label: "Watching", value: `${s.monitors.active}`, sub: s.monitors.total === s.monitors.active ? "monitors live" : `live, ${s.monitors.total - s.monitors.active} paused` },
    { label: "Alerts today", value: `${s.alerts24h}`, sub: "last 24 hours" },
    { label: "Delivered", value: rate === null ? "n/a" : `${rate.toFixed(rate === 100 ? 0 : 1)}%`, sub: `${s.deliveries.delivered} of ${finished} this week`, tone: rate !== null && rate < 95 ? "warn" : undefined },
    { label: "Retrying", value: `${s.deliveries.pending}`, sub: s.deliveries.pending ? "backing off, up to 6 tries" : "nothing stuck", tone: s.deliveries.pending ? "warn" : undefined },
  ];
  return (
    <section aria-label="Summary" className="grid grid-cols-2 divide-line rounded-xl border border-line bg-surface md:grid-cols-4 md:divide-x">
      {items.map((i) => (
        <div key={i.label} className="flex flex-col gap-1 px-5 py-4">
          <span className="text-sm text-muted">{i.label}</span>
          <span className={`font-mono text-2xl tracking-tight tabular-nums ${i.tone === "warn" ? "text-amber" : ""}`}>{i.value}</span>
          <span className="text-xs text-muted">{i.sub}</span>
        </div>
      ))}
    </section>
  );
}

function Templates() {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {MONITOR_TEMPLATES.map((t) => (
        <li key={t.id}>
          <Link href={`/dashboard/monitors/new?template=${t.id}`} className="group flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-4 hover:border-muted">
            <KindIcon kind={t.icon} className="size-9" />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-semibold group-hover:underline">{t.title}</span>
              <span className="text-xs leading-relaxed text-muted">{t.description}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function MonitorList() {
  const { org, can } = await requireOrg();
  const monitors = await listMonitors(org.id);
  const canToggle = can({ monitor: ["update"] });

  if (monitors.length === 0) {
    return (
      <section aria-labelledby="monitors" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="monitors" className="text-lg font-semibold tracking-tight">
            Start from a template
          </h2>
          <p className="text-sm text-muted">Nothing is being watched yet. Pick one, point it at a wallet or contract, and choose where alerts go.</p>
        </div>
        {can({ monitor: ["create"] }) ? <Templates /> : <p className="text-sm text-muted">Ask an admin or developer to create a monitor.</p>}
      </section>
    );
  }

  const [hourly, heads] = await Promise.all([
    alertsHourly(monitors.map((m) => m.id)),
    Promise.all([...new Set(monitors.map((m) => m.network))].map(async (n) => [n, await getHeadBlock(n)] as const)).then((e) => new Map(e)),
  ]);

  return (
    <section aria-labelledby="monitors" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="monitors" className="text-lg font-semibold tracking-tight">
          Your monitors
        </h2>
        <span className="text-sm text-muted">{monitors.length === 1 ? "1 monitor" : `${monitors.length} monitors`}</span>
      </div>
      <ul className="flex flex-col gap-3">
        {monitors.map((m) => {
          const head = heads.get(m.network) ?? null;
          const state = syncState({ enabled: m.enabled, lastError: m.lastError, lastCheckedBlock: m.lastCheckedBlock, head });
          return (
            <li key={m.id} className={`relative rounded-xl border bg-surface transition-colors hover:border-muted ${state.tone === "danger" ? "border-danger/40" : "border-line"}`}>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                <span className={m.enabled ? "" : "opacity-50 grayscale"}>
                  <AddressGlyph address={m.address} className="size-12" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/dashboard/monitors/${m.id}`} className="truncate font-semibold after:absolute after:inset-0 hover:underline">
                      {m.name}
                    </Link>
                    <StatusPill enabled={m.enabled} lastError={m.lastError} lastCheckedBlock={m.lastCheckedBlock} head={head} />
                  </span>
                  <span className="truncate text-sm text-muted">{describeMonitor(m)}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <NetworkChip network={m.network} />
                    <span className="font-mono">
                      {m.address.slice(0, 6)}…{m.address.slice(-4)}
                    </span>
                    {m.channels.length ? (
                      <span className="flex items-center gap-1">
                        {m.channels.slice(0, 3).map((c) => (c.kind === "telegram" ? <TelegramIcon key={c.channelId} className="size-3.5" /> : <WebhookIcon key={c.channelId} className="size-3.5" />))}
                        <span>{m.channels.length === 1 ? m.channels[0]!.name : `${m.channels.length} channels`}</span>
                      </span>
                    ) : (
                      <span className="text-amber">No channels, history only</span>
                    )}
                    <span>{m.lastTriggeredAt ? `last alert ${sinceNow(m.lastTriggeredAt)}` : "no alerts yet"}</span>
                  </span>
                </div>
                <div className="relative z-10 col-span-2 flex items-center justify-between gap-4 border-t border-line pt-3 sm:col-span-1 sm:border-0 sm:pt-0">
                  <HourBars data={hourly.get(m.id) ?? []} label={m.name} />
                  <EnabledSwitch id={m.id} enabled={m.enabled} disabled={!canToggle} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {can({ monitor: ["create"] }) ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-sm text-muted hover:text-ink">
            <span className="mr-1.5 inline-block transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
            Start another from a template
          </summary>
          <div className="mt-3">
            <Templates />
          </div>
        </details>
      ) : null}
    </section>
  );
}

async function RecentAlerts() {
  const { org } = await requireOrg();
  const alerts = await recentAlerts(org.id, { limit: 20 });
  return (
    <section aria-labelledby="alerts" className="flex flex-col gap-4">
      <h2 id="alerts" className="text-lg font-semibold tracking-tight">
        Alert history
      </h2>
      <AlertTimeline alerts={alerts} empty="When a monitor matches something on-chain, it lands here with where it was delivered. Use Send test on a monitor to see one now." />
    </section>
  );
}

async function Channels() {
  const { org, can } = await requireOrg();
  const channels = await listChannels(org.id);
  const canManage = can({ monitor: ["create"] });
  return (
    <section aria-labelledby="channels" className="flex flex-col gap-4 lg:sticky lg:top-10 lg:self-start">
      <div className="flex flex-col gap-1">
        <h2 id="channels" className="text-lg font-semibold tracking-tight">
          Channels
        </h2>
        <p className="text-sm text-muted">Where alerts are delivered. Each monitor picks its own.</p>
      </div>
      {channels.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-line p-5">
          <div className="flex gap-2">
            <TelegramIcon className="size-8" />
            <span className="grid size-8 place-items-center rounded-full bg-paper ring-1 ring-line">
              <WebhookIcon className="size-4 text-muted" />
            </span>
          </div>
          <p className="text-sm text-muted">Connect a Telegram chat for your team, or a webhook for your backend. Both get every alert from the monitors you assign.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {channels.map((c) => {
            const total = c.stats.delivered + c.stats.failed;
            const ok = total ? c.stats.delivered / total : 1;
            return (
              <li key={c.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start gap-3">
                  {c.kind === "telegram" ? (
                    <TelegramIcon className="size-9 shrink-0" />
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper ring-1 ring-line">
                      <WebhookIcon className="size-4.5 text-muted" />
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{c.name}</span>
                    <span className="truncate font-mono text-xs text-muted">
                      {c.kind === "webhook" ? (c.config as { url: string }).url.replace(/^https?:\/\//, "") : `Telegram ${(c.config as { chatType: string }).chatType}`}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="flex h-1.5 overflow-hidden rounded-full bg-paper" aria-hidden>
                    {total ? (
                      <>
                        <span className="bg-verdigris" style={{ width: `${ok * 100}%` }} />
                        <span className="bg-danger" style={{ width: `${(1 - ok) * 100}%` }} />
                      </>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted">{total ? `${c.stats.delivered} delivered, ${c.stats.failed} failed this week` : "No deliveries yet"}</span>
                </div>
                <div className="-mb-1 flex justify-end border-t border-line pt-2">
                  <ChannelActions id={c.id} name={c.name} canManage={canManage} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {canManage ? (
        <div className="grid grid-cols-2 gap-2">
          <ConnectTelegram channelCount={channels.filter((c) => c.kind === "telegram").length} />
          <AddWebhook />
        </div>
      ) : null}
    </section>
  );
}
