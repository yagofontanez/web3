"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "radix-ui";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

const sections: { href: string; label: string; icon: IconName; soon?: boolean }[] = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/dashboard/explorer", label: "Explorer", icon: "explorer" },
  { href: "/dashboard/developers", label: "API & keys", icon: "api" },
  { href: "/dashboard/monitors", label: "Monitors", icon: "monitors" },
  { href: "/dashboard/contracts", label: "Contract studio", icon: "contracts" },
  { href: "/dashboard/settings", label: "Organization", icon: "organization" },
];

function RailTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={10}
          className="z-50 hidden rounded-md bg-ink px-2 py-1 text-xs font-medium text-paper collapsed:md:block"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function Nav() {
  return <NavLinks pathname={usePathname()} />;
}

export function NavLinks({ pathname }: { pathname: string }) {
  return (
    <Tooltip.Provider delayDuration={150}>
      <nav aria-label="Main" className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0">
        {sections.map((s) => {
          const active = s.href === "/dashboard" ? pathname === s.href : pathname.startsWith(s.href);
          if (s.soon) {
            return (
              <RailTip key={s.href} label={`${s.label} (soon)`}>
                <span
                  tabIndex={-1}
                  className="hidden items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted/70 md:flex collapsed:md:justify-center collapsed:md:px-0"
                >
                  <Icon name={s.icon} className="shrink-0 opacity-60" />
                  <span className="flex-1 truncate collapsed:md:hidden">{s.label}</span>
                  <span className="text-[11px] collapsed:md:hidden">Soon</span>
                </span>
              </RailTip>
            );
          }
          return (
            <RailTip key={s.href} label={s.label}>
              <Link
                href={s.href}
                aria-label={s.label}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap collapsed:md:justify-center collapsed:md:px-0 collapsed:md:py-2 ${
                  active
                    ? "bg-surface font-medium text-ink shadow-[inset_2px_0_0_var(--verdigris)] collapsed:md:shadow-none"
                    : "text-muted hover:bg-surface/60 hover:text-ink"
                }`}
              >
                <Icon name={s.icon} className={`shrink-0 ${active ? "text-verdigris" : ""}`} />
                <span className="collapsed:md:hidden">{s.label}</span>
              </Link>
            </RailTip>
          );
        })}
      </nav>
    </Tooltip.Provider>
  );
}
