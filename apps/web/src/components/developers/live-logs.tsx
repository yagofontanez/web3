"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function LiveToggle({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const [pending, start] = useTransition();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      start(() => router.refresh());
      setTick((t) => t + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [live, intervalMs, router]);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={live}
        onClick={() => setLive((v) => !v)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${live ? "border-verdigris/40 bg-verdigris-soft/60 text-ink" : "border-line text-muted hover:text-ink"}`}
      >
        <span className="relative flex size-2" aria-hidden>
          {live ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-verdigris opacity-60" /> : null}
          <span className={`relative inline-flex size-2 rounded-full ${live ? "bg-verdigris" : "bg-muted/50"}`} />
        </span>
        {live ? "Live" : "Go live"}
      </button>
      {live ? (
        <span className="text-xs text-muted" aria-live="polite">
          {pending ? "Updating…" : tick > 0 ? `Updated every ${intervalMs / 1000}s` : "Watching for new requests"}
        </span>
      ) : (
        <button type="button" onClick={() => start(() => router.refresh())} className="text-xs text-muted hover:text-ink">
          {pending ? "Refreshing…" : "Refresh"}
        </button>
      )}
    </div>
  );
}

export type LogRowData = {
  id: number;
  method: string;
  path: string;
  route: string;
  status: number;
  durationMs: number;
  errorCode: string | null;
  createdAt: string;
  keyName: string | null;
  keyPrefix: string | null;
  ip: string | null;
};

const timeFmt = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "medium" });

function StatusBadge({ status }: { status: number }) {
  const tone = status >= 500 ? "bg-danger/15 text-danger" : status >= 400 ? "bg-amber-soft text-amber" : "bg-verdigris-soft text-verdigris";
  return <span className={`inline-flex w-11 justify-center rounded px-1.5 py-0.5 font-mono text-xs font-medium ${tone}`}>{status}</span>;
}

function LatencyBar({ ms }: { ms: number }) {
  const pct = Math.min(100, (Math.log10(Math.max(ms, 1)) / Math.log10(5000)) * 100);
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="font-mono text-xs tabular-nums">{ms} ms</span>
      <span className="hidden h-1 w-14 overflow-hidden rounded-full bg-paper sm:block" aria-hidden>
        <span className={`block h-full rounded-full ${ms > 1000 ? "bg-amber" : "bg-verdigris/70"}`} style={{ width: `${Math.max(4, pct)}%` }} />
      </span>
    </span>
  );
}

export function LogTable({ rows }: { rows: LogRowData[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="hidden grid-cols-[5.5rem_3.5rem_minmax(0,1fr)_8rem_9rem] gap-4 border-b border-line px-4 py-2.5 text-xs text-muted md:grid">
        <span>Time</span>
        <span>Status</span>
        <span>Request</span>
        <span className="text-right">Latency</span>
        <span>Key</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const expanded = open === r.id;
          const at = new Date(r.createdAt);
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : r.id)}
                className={`grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-paper/60 md:grid-cols-[5.5rem_3.5rem_minmax(0,1fr)_8rem_9rem] md:gap-4 ${expanded ? "bg-paper/60" : ""}`}
              >
                <span className="hidden font-mono text-xs text-muted tabular-nums md:block" title={dateFmt.format(at)}>
                  {timeFmt.format(at)}
                </span>
                <StatusBadge status={r.status} />
                <span className="min-w-0 truncate font-mono text-xs">
                  <span className="text-muted">{r.method}</span> {r.path}
                  {r.errorCode ? <span className="ml-2 text-muted">{r.errorCode}</span> : null}
                </span>
                <LatencyBar ms={r.durationMs} />
                <span className="hidden truncate text-xs text-muted md:block">{r.keyName ?? r.keyPrefix}</span>
              </button>
              {expanded ? (
                <dl className="grid gap-x-6 gap-y-2 bg-paper/60 px-4 pb-4 text-xs sm:grid-cols-[8rem_minmax(0,1fr)]">
                  {[
                    ["Time", dateFmt.format(at)],
                    ["Endpoint", r.route],
                    ["Path", r.path],
                    ["Status", `${r.status}${r.errorCode ? `, ${r.errorCode}` : ""}`],
                    ["Latency", `${r.durationMs} ms`],
                    ["Key", `${r.keyName ?? "Unknown"} (${r.keyPrefix ?? "?"}…)`],
                    ["Client IP", r.ip ?? "unknown"],
                  ].map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted">{k}</dt>
                      <dd className="font-mono break-all">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
