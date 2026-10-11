import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@w3s/db";
import { addressUrl, networkBySlug } from "@w3s/explorer";
import type { EventParams, TransferParams } from "@w3s/db/schema";
import { AlertFeed } from "@/components/monitors/alert-feed";
import { TelegramIcon, WebhookIcon } from "@/components/monitors/channels";
import { DeleteMonitorButton, EnabledSwitch, TestAlertButton } from "@/components/monitors/monitor-controls";
import { requireOrg } from "@/lib/dal";
import { sinceNow } from "@/lib/format";
import { getMonitor, recentAlerts } from "@/lib/monitoring";
import { describeMonitor } from "@/lib/monitor-describe";

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
  const [alerts, channels] = await Promise.all([
    recentAlerts(org.id, { monitorId: m.id, limit: 50 }),
    m.channelIds.length
      ? db
          .select({ id: schema.notificationChannel.id, name: schema.notificationChannel.name, kind: schema.notificationChannel.kind })
          .from(schema.notificationChannel)
          .where(and(eq(schema.notificationChannel.organizationId, org.id), isNull(schema.notificationChannel.disabledAt)))
      : Promise.resolve([]),
  ]);
  const linked = channels.filter((c) => m.channelIds.includes(c.id));
  const net = networkBySlug(m.network);
  const p = m.params as TransferParams & EventParams;
  const details: [string, React.ReactNode][] = [
    ["Network", net?.name ?? m.network],
    [
      m.kind === "event" ? "Contract" : "Wallet",
      net ? (
        <a href={addressUrl(net, m.address)} target="_blank" rel="noreferrer" className="font-mono hover:underline">
          {m.address}
        </a>
      ) : (
        m.address
      ),
    ],
    ...(m.kind === "event"
      ? ([["Event", <span key="e" className="font-mono">{p.signature}</span>]] as [string, React.ReactNode][])
      : ([
          ["Direction", p.direction === "in" ? "Incoming" : p.direction === "out" ? "Outgoing" : "Both"],
          ["Asset", p.asset === "any" ? "Any asset" : p.asset === "native" ? "Native coin" : <span key="a" className="font-mono">{p.asset}</span>],
          ["Minimum", p.minAmount ? Number(p.minAmount).toLocaleString("en") : "None"],
        ] as [string, React.ReactNode][])),
    ["Checked up to", m.lastCheckedBlock ? `block ${m.lastCheckedBlock.toLocaleString("en")}` : "Starts on the next scan"],
    ["Created", sinceNow(m.createdAt)],
  ];

  return (
    <>
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-3">
            <EnabledSwitch id={m.id} enabled={m.enabled} disabled={!can({ monitor: ["update"] })} />
            <h1 className="truncate text-3xl font-semibold tracking-[-0.02em]">{m.name}</h1>
          </div>
          <p className="text-muted">{describeMonitor(m)}</p>
        </div>
        {can({ monitor: ["update"] }) ? (
          <div className="flex shrink-0 gap-2">
            <Link href={`/dashboard/monitors/${m.id}/edit`} className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium hover:border-muted">
              Edit
            </Link>
          </div>
        ) : null}
      </header>

      {m.lastError ? (
        m.lastError.startsWith("Paused automatically") ? (
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

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-labelledby="history" className="flex min-w-0 flex-col gap-4">
          <h2 id="history" className="text-lg font-semibold tracking-tight">
            Alert history
          </h2>
          <AlertFeed alerts={alerts} showMonitor={false} empty="No alerts yet. Send a test to check that your channels receive them." />
        </section>
        <aside className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">Settings</h2>
            <dl className="divide-y divide-line rounded-xl border border-line bg-surface text-sm">
              {details.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5 px-4 py-2.5">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">Delivers to</h2>
            {linked.length === 0 ? (
              <p className="text-sm text-muted">No channels. Alerts are only kept in the history.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {linked.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5 text-sm">
                    {c.kind === "telegram" ? <TelegramIcon className="size-5" /> : <WebhookIcon className="size-5 text-muted" />}
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
            {can({ monitor: ["update"] }) ? <TestAlertButton id={m.id} /> : null}
          </section>
          {can({ monitor: ["delete"] }) ? (
            <section className="flex flex-col gap-3 border-t border-line pt-6">
              <DeleteMonitorButton id={m.id} name={m.name} />
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
