import Link from "next/link";
import { networkBySlug, txUrl } from "@w3s/explorer";
import type { recentAlerts } from "@/lib/monitoring";
import { sinceNow } from "@/lib/format";

type AlertRow = Awaited<ReturnType<typeof recentAlerts>>[number];

function DeliveryChip({ d }: { d: AlertRow["deliveries"][number] }) {
  const tone = d.status === "delivered" ? "text-verdigris" : d.status === "failed" ? "text-danger" : "text-amber";
  const icon = d.status === "delivered" ? "✓" : d.status === "failed" ? "✕" : "…";
  const title = d.status === "failed" ? `${d.lastError ?? "Failed"} after ${d.attempts} attempts` : d.status === "pending" ? `Retrying, ${d.attempts} attempts so far${d.lastError ? `: ${d.lastError}` : ""}` : "Delivered";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] ${tone}`} title={title}>
      <span aria-hidden>{icon}</span>
      <span className="text-muted">{d.channelName}</span>
    </span>
  );
}

export function AlertFeed({ alerts, showMonitor = true, empty }: { alerts: AlertRow[]; showMonitor?: boolean; empty: string }) {
  if (alerts.length === 0) return <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">{empty}</p>;
  return (
    <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
      {alerts.map((a) => {
        const net = networkBySlug(a.payload.network);
        const realTx = a.payload.blockNumber > 0;
        return (
          <li key={a.id} className="flex flex-col gap-2 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {a.test ? <span className="rounded bg-amber-soft px-1.5 py-0.5 text-[11px] font-medium text-amber">Test</span> : null}
                  <span className="min-w-0">{a.title}</span>
                </span>
                <span className="flex flex-wrap gap-x-3 text-xs text-muted">
                  {showMonitor ? (
                    <Link href={`/dashboard/monitors/${a.monitorId}`} className="hover:text-ink hover:underline">
                      {a.monitorName}
                    </Link>
                  ) : null}
                  {realTx ? <span className="font-mono">block {a.payload.blockNumber.toLocaleString("en")}</span> : null}
                  {realTx && net ? (
                    <a href={txUrl(net, a.payload.txHash)} target="_blank" rel="noreferrer" className="font-mono hover:text-ink hover:underline">
                      {a.payload.txHash.slice(0, 10)}…
                    </a>
                  ) : null}
                  {a.payload.kind === "event" && a.payload.args
                    ? Object.entries(a.payload.args)
                        .slice(0, 2)
                        .map(([k, val]) => (
                          <span key={k} className="font-mono">
                            {k}={val.length > 14 ? `${val.slice(0, 8)}…` : val}
                          </span>
                        ))
                    : null}
                </span>
              </div>
              <time className="shrink-0 text-xs text-muted" dateTime={a.createdAt.toISOString()}>
                {sinceNow(a.createdAt)}
              </time>
            </div>
            {a.deliveries.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {a.deliveries.map((d, i) => (
                  <DeliveryChip key={i} d={d} />
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted">Not sent anywhere. Add a channel to this monitor to get notified.</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
