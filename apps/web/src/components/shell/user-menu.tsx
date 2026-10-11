"use client";

import { DropdownMenu } from "radix-ui";
import { authClient } from "@/lib/auth-client";
import { reloadTo } from "@/lib/navigation";

const item =
  "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-paper";

export function UserMenu({ name, email }: { name: string; email: string }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-verdigris data-[state=open]:bg-surface collapsed:md:justify-center collapsed:md:p-1"
        aria-label={`Account: ${name}`}
      >
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 flex-col collapsed:md:hidden">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="truncate text-xs text-muted">{email}</span>
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={6}
          className="menu-content z-50 w-60 rounded-xl border border-line bg-surface p-1.5 text-ink shadow-[0_12px_32px_-12px_rgb(0_0_0/0.35)]"
        >
          <div className="flex flex-col px-2 pt-1 pb-2">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="truncate text-xs text-muted">{email}</span>
          </div>
          <DropdownMenu.Separator className="mb-1.5 h-px bg-line" />
          <DropdownMenu.Item
            className={item}
            onSelect={async () => {
              await authClient.signOut();
              reloadTo("/sign-in");
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden>
              <path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6M10.5 11 13.5 8l-3-3M13.5 8H6" />
            </svg>
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
