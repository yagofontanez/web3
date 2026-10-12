import { networkBySlug } from "@w3s/explorer";

export function KindIcon({ kind, className = "" }: { kind: "in" | "out" | "self" | "event"; className?: string }) {
  const base = `grid shrink-0 place-items-center rounded-full ${className}`;
  if (kind === "event")
    return (
      <span className={`${base} bg-paper text-ink ring-1 ring-line`} aria-hidden>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 1.5 3.5 9H8l-1 5.5L12.5 7H8z" />
        </svg>
      </span>
    );
  return (
    <span className={`${base} ${kind === "in" ? "bg-verdigris-soft text-verdigris" : "bg-paper text-ink ring-1 ring-line"}`} aria-hidden>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {kind === "in" ? <path d="M8 2.5v11M3.5 9 8 13.5 12.5 9" /> : kind === "out" ? <path d="M8 13.5v-11M3.5 7 8 2.5 12.5 7" /> : <path d="M3 8a5 5 0 0 1 9-3M13 8a5 5 0 0 1-9 3M12 2v3h-3M4 14v-3h3" />}
      </svg>
    </span>
  );
}

export function NetworkChip({ network }: { network: string }) {
  const net = networkBySlug(network);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
      <span aria-hidden className={`size-1.5 rounded-full ${net?.testnet ? "bg-amber" : "bg-verdigris"}`} />
      {net?.name ?? network}
    </span>
  );
}

export type SyncInfo = { enabled: boolean; lastError: string | null; lastCheckedBlock: number | null; head: number | null };

export function syncState(s: SyncInfo) {
  if (!s.enabled) return s.lastError?.startsWith("Paused automatically") ? { tone: "amber", label: "Auto-paused" } : { tone: "muted", label: "Paused" };
  if (s.lastError) return { tone: "danger", label: "Scan failing" };
  if (s.lastCheckedBlock === null) return { tone: "amber", label: "Starting" };
  if (s.head === null) return { tone: "verdigris", label: "Live" };
  const lag = Math.max(0, s.head - s.lastCheckedBlock);
  return lag <= 40 ? { tone: "verdigris", label: "Live" } : { tone: "amber", label: `${lag.toLocaleString("en")} blocks behind` };
}

const TONES: Record<string, string> = {
  verdigris: "border-verdigris/30 bg-verdigris-soft/50 text-ink",
  amber: "border-amber/30 bg-amber-soft text-amber",
  danger: "border-danger/30 bg-danger/10 text-danger",
  muted: "border-line bg-paper text-muted",
};
const DOTS: Record<string, string> = { verdigris: "bg-verdigris", amber: "bg-amber", danger: "bg-danger", muted: "bg-muted/50" };

export function StatusPill(props: SyncInfo) {
  const s = syncState(props);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[s.tone]}`}>
      <span className="relative flex size-1.5" aria-hidden>
        {s.label === "Live" ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-verdigris opacity-60" /> : null}
        <span className={`relative inline-flex size-1.5 rounded-full ${DOTS[s.tone]}`} />
      </span>
      {s.label}
    </span>
  );
}

export function HourBars({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data, 1);
  const total = data.reduce((a, b) => a + b, 0);
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex h-7 items-end gap-px" role="img" aria-label={`${label}: ${total} alerts in the last 24 hours`}>
        {data.map((v, i) => (
          <span key={i} className={`w-1 rounded-t-[1px] ${v ? "bg-verdigris" : "bg-line"}`} style={{ height: v ? `${Math.max(14, (v / max) * 100)}%` : "2px" }} title={`${v} alerts, ${data.length - i}h ago`} />
        ))}
      </span>
      <span className="text-[11px] text-muted tabular-nums">{total === 0 ? "No alerts in 24h" : `${total} in 24h`}</span>
    </span>
  );
}
