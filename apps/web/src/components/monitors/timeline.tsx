import Link from "next/link";
import { networkBySlug, txUrl } from "@w3s/explorer";
import type { recentAlerts } from "@/lib/monitoring";
import { sinceNow } from "@/lib/format";
import { TelegramIcon, WebhookIcon } from "./channels";
import { KindIcon, NetworkChip } from "./visuals";

type AlertRow = Awaited<ReturnType<typeof recentAlerts>>[number];

const dayFmt = new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" });

function dayLabel(d: Date) {
  const today = new Date();
  const key = (x: Date) => x.toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (key(d) === key(today)) return "Today";
  if (key(d) === key(yesterday)) return "Yesterday";
  return dayFmt.format(d);
}

function amount(a: AlertRow) {
  const p = a.payload;
  if (p.kind !== "transfer" || !p.value) return null;
  const n = Number(p.value);
  const v = Number.isFinite(n) ? n.toLocaleString("en", { maximumFractionDigits: n >= 1000 ? 2 : 4 }) : p.value;
  return `${p.direction === "out" ? "−" : p.direction === "in" ? "+" : ""}${v} ${p.asset ?? ""}`.trim();
}

function Delivery({ d }: { d: AlertRow["deliveries"][number] }) {
  const tone = d.status === "delivered" ? "text-verdigris" : d.status === "failed" ? "text-danger" : "text-amber";
  const label = d.status === "delivered" ? "Delivered" : d.status === "failed" ? `Failed after ${d.attempts} attempts${d.lastError ? `: ${d.lastError}` : ""}` : `Retrying (${d.attempts} so far)${d.lastError ? `: ${d.lastError}` : ""}`;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pr-2 pl-1 text-[11px]" title={label}>
      {d.channelKind === "telegram" ? <TelegramIcon className="size-3.5" /> : <WebhookIcon className="size-3.5 text-muted" />}
      <span className="max-w-32 truncate text-muted">{d.channelName}</span>
      <span className={tone} aria-label={label}>
        {d.status === "delivered" ? "✓" : d.status === "failed" ? "✕" : "…"}
      </span>
    </span>
  );
}

export function AlertTimeline({ alerts, showMonitor = true, empty }: { alerts: AlertRow[]; showMonitor?: boolean; empty: React.ReactNode }) {
  if (alerts.length === 0) return <div className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">{empty}</div>;
  const groups: { label: string; items: AlertRow[] }[] = [];
  for (const a of alerts) {
    const label = dayLabel(a.createdAt);
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(a);
    else groups.push({ label, items: [a] });
  }
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.label} className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted">{g.label}</h3>
          <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
            {g.items.map((a) => {
              const p = a.payload;
              const net = networkBySlug(p.network);
              const real = p.blockNumber > 0 && p.txHash.length > 10;
              const summary = a.title.includes(" matches in ") || a.title.includes(" was paused");
              const amt = summary ? null : amount(a);
              return (
                <li key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 py-3.5">
                  <KindIcon kind={p.kind === "event" ? "event" : (p.direction ?? "in")} className="mt-0.5 size-8" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      {a.test ? <span className="rounded bg-amber-soft px-1.5 py-0.5 text-[11px] font-medium text-amber">Test</span> : null}
                      {summary ? <span className="rounded bg-paper px-1.5 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">Summary</span> : null}
                      <span className="min-w-0 font-medium">{a.title}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <NetworkChip network={p.network} />
                      {showMonitor ? (
                        <Link href={`/dashboard/monitors/${a.monitorId}`} className="hover:text-ink hover:underline">
                          {a.monitorName}
                        </Link>
                      ) : null}
                      {real && net ? (
                        <a href={txUrl(net, p.txHash)} target="_blank" rel="noreferrer" className="font-mono hover:text-ink hover:underline">
                          {p.txHash.slice(0, 10)}…
                        </a>
                      ) : null}
                      {p.kind === "event" && p.args
                        ? Object.entries(p.args)
                            .slice(0, 3)
                            .map(([k, v]) => (
                              <span key={k} className="font-mono">
                                {k} <span className="text-ink">{v.length > 14 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v}</span>
                              </span>
                            ))
                        : null}
                    </span>
                    {a.deliveries.length ? (
                      <span className="flex flex-wrap gap-1.5 pt-0.5">
                        {a.deliveries.map((d, i) => (
                          <Delivery key={i} d={d} />
                        ))}
                      </span>
                    ) : (
                      <span className="text-xs text-amber">Kept in history only. This monitor has no channels.</span>
                    )}
                  </div>
                  <span className="flex flex-col items-end gap-1">
                    {amt ? <span className={`font-mono text-sm tabular-nums ${p.direction === "in" ? "text-verdigris" : ""}`}>{amt}</span> : null}
                    <time className="text-xs text-muted" dateTime={a.createdAt.toISOString()}>
                      {sinceNow(a.createdAt)}
                    </time>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
