"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export const TABS = [
  { id: "tokens", label: "Tokens" },
  { id: "nfts", label: "NFTs" },
  { id: "activity", label: "Activity" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function Tabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("tab") ?? "tokens";
  return (
    <nav aria-label="Address sections" className="flex gap-6 border-b border-line">
      {TABS.map((t) => {
        const next = new URLSearchParams(params);
        next.set("tab", t.id);
        const active = current === t.id;
        return (
          <Link
            key={t.id}
            href={`${pathname}?${next}`}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2.5 text-sm ${active ? "border-verdigris font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function NetworkPicker({ networks, current, allowAll }: { networks: { slug: string; name: string }[]; current: string; allowAll: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const options = allowAll ? [{ slug: "all", name: "All networks" }, ...networks] : networks;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Network">
      {options.map((n) => {
        const next = new URLSearchParams(params);
        next.set("network", n.slug);
        const active = current === n.slug;
        return (
          <Link
            key={n.slug}
            href={`${pathname}?${next}`}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-xs ${active ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-muted hover:text-ink"}`}
          >
            {n.name}
          </Link>
        );
      })}
    </div>
  );
}
