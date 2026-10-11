import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertFeed } from "@/components/monitors/alert-feed";
import { ChannelActions, ConnectTelegram, AddWebhook, TelegramIcon, WebhookIcon } from "@/components/monitors/channels";
import { EnabledSwitch } from "@/components/monitors/monitor-controls";
import { StatTile } from "@/components/developers/usage-chart";
import { requireOrg } from "@/lib/dal";
import { sinceNow } from "@/lib/format";
import { listChannels, listMonitors, monitoringSummary, recentAlerts } from "@/lib/monitoring";
import { describeMonitor } from "@/lib/monitor-describe";

export const metadata: Metadata = { title: "Monitors" };

export default function MonitorsPage() {
  return (
    <div className="flex max-w-6xl flex-col gap-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">Monitors</h1>
          <p className="max-w-[62ch] text-muted">Watch wallets and contracts on every network and get told the moment something moves, in Telegram or on your own servers.</p>
        </div>
        <Suspense>
          <NewIfAllowed />
        </Suspense>
      </header>
      <Suspense fallback={<div className="h-28 animate-pulse rounded-xl border border-line bg-surface" />}>
        <Summary />
      </Suspense>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-10">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-xl border border-line bg-surface" />}>
            <MonitorList />
          </Suspense>
          <Suspense fallback={<div className="h-48 animate-pulse rounded-xl border border-line bg-surface" />}>
            <RecentAlerts />
          </Suspense>
        </div>
        <Suspense fallback={<div className="h-48 animate-pulse rounded-xl border border-line bg-surface" />}>
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
  return (
    <section aria-label="Summary" className="grid grid-cols-2 gap-6 rounded-xl border border-line bg-surface p-6 md:grid-cols-4">
      <StatTile label="Active monitors" value={String(s.monitors.active)} sub={`${s.monitors.total} in total`} />
      <StatTile label="Alerts, 24h" value={String(s.alerts24h)} sub="Test alerts not counted" />
      <StatTile label="Delivery success, 7d" value={rate === null ? "n/a" : `${rate.toFixed(rate === 100 ? 0 : 1)}%`} sub={`${s.deliveries.delivered} delivered, ${s.deliveries.failed} failed`} tone={rate !== null && rate < 95 ? "warn" : "neutral"} />
      <StatTile label="Retrying now" value={String(s.deliveries.pending)} sub="Backing off up to 6 attempts" tone={s.deliveries.pending ? "warn" : "neutral"} />
    </section>
  );
}

async function MonitorList() {
  const { org, can } = await requireOrg();
  const monitors = await listMonitors(org.id);
  const canToggle = can({ monitor: ["update"] });
  return (
    <section aria-labelledby="monitors" className="flex flex-col gap-4">
      <h2 id="monitors" className="text-lg font-semibold tracking-tight">
        Your monitors
      </h2>
      {monitors.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line p-6">
          <p className="font-medium">Nothing is being watched yet</p>
          <p className="max-w-[56ch] text-sm text-muted">
            Start with a saved wallet: get a message when it receives more than a set amount, or whenever anything leaves it.
          </p>
          {can({ monitor: ["create"] }) ? (
            <Link href="/dashboard/monitors/new" className="text-sm font-medium underline underline-offset-4">
              Create your first monitor
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {monitors.map((m) => (
            <li key={m.id} className="flex items-center gap-4 px-4 py-4">
              <EnabledSwitch id={m.id} enabled={m.enabled} disabled={!canToggle} />
              <Link href={`/dashboard/monitors/${m.id}`} className="group flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={`flex items-center gap-2 truncate font-medium group-hover:underline ${m.enabled ? "" : "text-muted"}`}>
                  {m.name}
                  {m.lastError?.startsWith("Paused automatically") ? (
                    <span className="rounded bg-amber-soft px-1.5 py-0.5 text-[11px] font-normal text-amber">Auto-paused</span>
                  ) : m.lastError ? (
                    <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[11px] font-normal text-danger">Error</span>
                  ) : null}
                  {!m.enabled && !m.lastError?.startsWith("Paused automatically") ? (
                    <span className="rounded bg-paper px-1.5 py-0.5 text-[11px] font-normal text-muted ring-1 ring-line">Paused</span>
                  ) : null}
                </span>
                <span className="truncate text-sm text-muted">{describeMonitor(m)}</span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="font-mono">{m.address.slice(0, 6)}…{m.address.slice(-4)}</span>
                  {m.channels.length ? (
                    <span className="flex items-center gap-1.5">
                      {m.channels.map((c) => (c.kind === "telegram" ? <TelegramIcon key={c.channelId} className="size-3.5" /> : <WebhookIcon key={c.channelId} className="size-3.5" />))}
                      {m.channels.length === 1 ? m.channels[0]!.name : `${m.channels.length} channels`}
                    </span>
                  ) : (
                    <span className="text-amber">No channels</span>
                  )}
                  <span>{m.lastTriggeredAt ? `last alert ${sinceNow(m.lastTriggeredAt)}` : "no alerts yet"}</span>
                </span>
              </Link>
              <span className="hidden shrink-0 flex-col items-end sm:flex">
                <span className="font-mono text-lg tabular-nums">{m.alerts24h}</span>
                <span className="text-xs text-muted">alerts, 24h</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function RecentAlerts() {
  const { org } = await requireOrg();
  const alerts = await recentAlerts(org.id, { limit: 15 });
  return (
    <section aria-labelledby="alerts" className="flex flex-col gap-4">
      <h2 id="alerts" className="text-lg font-semibold tracking-tight">
        Recent alerts
      </h2>
      <AlertFeed alerts={alerts} empty="When a monitor matches something on-chain, it shows up here with where it was delivered." />
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
        <p className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">Connect a Telegram chat or add a webhook to start receiving alerts.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {channels.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-4 py-3.5">
              {c.kind === "telegram" ? <TelegramIcon className="mt-0.5 size-6 shrink-0" /> : <WebhookIcon className="mt-0.5 size-6 shrink-0 text-muted" />}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{c.name}</span>
                <span className="truncate font-mono text-xs text-muted">
                  {c.kind === "webhook" ? (c.config as { url: string }).url.replace(/^https?:\/\//, "") : `${(c.config as { chatType: string }).chatType} chat`}
                </span>
                <span className="text-xs text-muted">
                  {c.stats.delivered + c.stats.failed === 0 ? "No deliveries yet" : `${c.stats.delivered} delivered, ${c.stats.failed} failed this week`}
                </span>
              </div>
              <ChannelActions id={c.id} name={c.name} canManage={canManage} />
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <ConnectTelegram channelCount={channels.filter((c) => c.kind === "telegram").length} />
          <AddWebhook />
        </div>
      ) : null}
    </section>
  );
}
