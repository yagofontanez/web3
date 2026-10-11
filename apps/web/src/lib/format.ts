const usdFmt = new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat("en", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

export function formatUsd(value: number | null | undefined, compact = false) {
  if (value === null || value === undefined) return "n/a";
  if (value > 0 && value < 0.01) return "<$0.01";
  return compact && value >= 100_000 ? usdCompact.format(value) : usdFmt.format(value);
}

export function formatAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "n/a";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (n === 0) return "0";
  if (Math.abs(n) < 0.0001) return "<0.0001";
  if (Math.abs(n) >= 1e9) return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(n);
  return n.toLocaleString("en", { maximumFractionDigits: Math.abs(n) >= 1000 ? 2 : 4 });
}

export function timeAgo(iso: string | null, now: number) {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en", { dateStyle: "medium" });
}

export function sinceNow(date: Date | string) {
  return timeAgo(typeof date === "string" ? date : date.toISOString(), Date.now());
}

export function isWithin(date: Date | string, ms: number) {
  return Date.now() - new Date(date).getTime() < ms;
}
