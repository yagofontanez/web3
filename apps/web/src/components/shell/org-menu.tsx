"use client";

import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { reloadTo } from "@/lib/navigation";
import { OrgGlyph } from "../org-glyph";

type Org = { id: string; name: string; slug: string };

const item =
  "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-paper data-[disabled]:opacity-50";

export function OrgMenu({ orgs, activeId, role }: { orgs: Org[]; activeId: string; role: string }) {
  const [switching, setSwitching] = useState<string | null>(null);
  const active = orgs.find((o) => o.id === activeId);

  async function switchTo(id: string) {
    if (id === activeId) return;
    setSwitching(id);
    const { error } = await authClient.organization.setActive({ organizationId: id });
    if (error) return setSwitching(null);
    reloadTo("/dashboard");
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="group flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-verdigris data-[state=open]:bg-surface collapsed:md:justify-center collapsed:md:p-1"
        aria-label={`Organization: ${active?.name ?? "none"}. Switch organization`}
      >
        <OrgGlyph id={activeId} className="size-8" />
        <span className="flex min-w-0 flex-1 flex-col collapsed:md:hidden">
          <span className="truncate text-sm font-semibold">{active?.name}</span>
          <span className="truncate text-xs text-muted capitalize">{role}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0 text-muted collapsed:md:hidden" aria-hidden>
          <path d="m5 6 3-3 3 3M5 10l3 3 3-3" />
        </svg>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="menu-content z-50 w-64 rounded-xl border border-line bg-surface p-1.5 text-ink shadow-[0_12px_32px_-12px_rgb(0_0_0/0.35)]"
        >
          <DropdownMenu.Label className="px-2 pt-1 pb-1.5 text-xs text-muted">Organizations</DropdownMenu.Label>
          {orgs.map((o) => (
            <DropdownMenu.Item
              key={o.id}
              className={item}
              disabled={switching !== null}
              onSelect={(e) => {
                e.preventDefault();
                switchTo(o.id);
              }}
            >
              <OrgGlyph id={o.id} className="size-6" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{o.name}</span>
              </span>
              {switching === o.id ? (
                <span className="text-xs text-muted">Opening…</span>
              ) : o.id === activeId ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--verdigris)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Current">
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              ) : null}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1.5 h-px bg-line" />
          <DropdownMenu.Item className={item} onSelect={() => reloadTo("/dashboard/settings")}>
            <span className="grid size-6 place-items-center text-muted" aria-hidden>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="8" r="2" />
                <path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8 3.4 3.4" />
              </svg>
            </span>
            Settings and members
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => reloadTo("/onboarding")}>
            <span className="grid size-6 place-items-center rounded-md border border-dashed border-line text-muted" aria-hidden>
              +
            </span>
            New organization
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
