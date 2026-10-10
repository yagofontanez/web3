"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "./ui";

const sections = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/explorer", label: "Explorer", soon: true },
  { href: "/dashboard/developers", label: "API & keys", soon: true },
  { href: "/dashboard/monitors", label: "Monitors", soon: true },
  { href: "/dashboard/contracts", label: "Contract studio", soon: true },
  { href: "/dashboard/settings", label: "Organization" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:gap-0.5 md:px-0">
      {sections.map((s) => {
        const active = s.href === "/dashboard" ? pathname === s.href : pathname.startsWith(s.href);
        if (s.soon) {
          return (
            <span key={s.href} className="hidden items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-muted md:flex">
              {s.label}
              <Badge>Soon</Badge>
            </span>
          );
        }
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap ${active ? "bg-surface font-medium text-ink shadow-[inset_2px_0_0_var(--verdigris)]" : "text-muted hover:text-ink"}`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
