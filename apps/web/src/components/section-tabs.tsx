"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function SectionTabs({ tabs, label, fallback }: { tabs: { id: string; label: string; count?: number }[]; label: string; fallback: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("tab") ?? fallback;
  return (
    <nav aria-label={label} className="-mx-4 flex gap-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const next = new URLSearchParams(params);
        next.set("tab", t.id);
        const active = current === t.id;
        return (
          <Link
            key={t.id}
            href={`${pathname}?${next}`}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-2.5 text-sm whitespace-nowrap ${
              active ? "border-verdigris font-medium text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.count !== undefined ? <span className="rounded-full bg-surface px-1.5 text-xs text-muted ring-1 ring-line">{t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
