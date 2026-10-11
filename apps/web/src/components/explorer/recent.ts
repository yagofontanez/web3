export type RecentLookup = { address: string; ens: string | null; at: number };

const KEY = "w3s:explorer:recent";
const MAX = 6;

export function readRecent(): RecentLookup[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentLookup[]) : [];
    return Array.isArray(list) ? list.filter((r) => typeof r?.address === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(entry: Omit<RecentLookup, "at">) {
  try {
    const next = [{ ...entry, at: Date.now() }, ...readRecent().filter((r) => r.address.toLowerCase() !== entry.address.toLowerCase())].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("w3s:recent"));
  } catch {}
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("w3s:recent"));
  } catch {}
}
