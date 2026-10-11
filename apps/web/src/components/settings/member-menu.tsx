"use client";

import { useRouter } from "next/navigation";
import { AlertDialog, DropdownMenu } from "radix-ui";
import { useState } from "react";
import type { OrgRole } from "@w3s/shared/permissions";
import { authClient } from "@/lib/auth-client";
import { Button, FormError } from "../ui";
import { ROLE_INFO, ROLE_ORDER } from "./roles";

const item =
  "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-paper data-[disabled]:cursor-default data-[disabled]:opacity-40";

export function MemberMenu({
  organizationId,
  memberId,
  name,
  role,
  canAssignOwner,
}: {
  organizationId: string;
  memberId: string;
  name: string;
  role: string;
  canAssignOwner: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function changeRole(next: OrgRole) {
    if (next === role) return;
    setError(null);
    setBusy(true);
    const { error } = await authClient.organization.updateMemberRole({ organizationId, memberId, role: next });
    setBusy(false);
    if (error) return setError(error.message ?? "Could not change the role.");
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const { error } = await authClient.organization.removeMember({ organizationId, memberIdOrEmail: memberId });
    setBusy(false);
    setConfirm(false);
    if (error) return setError(error.message ?? "Could not remove the member.");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          disabled={busy}
          className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-sm hover:border-muted data-[state=open]:border-muted disabled:opacity-50"
          aria-label={`Manage ${name}`}
        >
          {busy ? "Saving…" : ROLE_INFO[role as OrgRole]?.label ?? role}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="text-muted">
            <path d="m4 6 4 4 4-4" />
          </svg>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="menu-content z-50 w-72 rounded-xl border border-line bg-surface p-1.5 text-ink shadow-[0_12px_32px_-12px_rgb(0_0_0/0.35)]"
          >
            <DropdownMenu.Label className="px-2 pt-1 pb-1.5 text-xs text-muted">Role</DropdownMenu.Label>
            <DropdownMenu.RadioGroup value={role} onValueChange={(v) => changeRole(v as OrgRole)}>
              {ROLE_ORDER.map((r) => (
                <DropdownMenu.RadioItem key={r} value={r} disabled={r === "owner" && !canAssignOwner} className={`${item} items-start`}>
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
                    <DropdownMenu.ItemIndicator>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--verdigris)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m3.5 8.5 3 3 6-7" />
                      </svg>
                    </DropdownMenu.ItemIndicator>
                  </span>
                  <span className="flex flex-col">
                    <span>{ROLE_INFO[r].label}</span>
                    <span className="text-xs text-muted">{ROLE_INFO[r].summary}</span>
                  </span>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator className="my-1.5 h-px bg-line" />
            <DropdownMenu.Item className={`${item} text-danger`} onSelect={() => setConfirm(true)}>
              Remove from organization
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <FormError message={error} />

      <AlertDialog.Root open={confirm} onOpenChange={setConfirm}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-line bg-surface p-6 text-ink shadow-2xl">
            <AlertDialog.Title className="text-lg font-semibold">Remove {name}?</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted">
              They lose access to this organization right away. Anything they created stays. You can invite them again later.
            </AlertDialog.Description>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Keep {name.split(" ")[0]}</Button>
              </AlertDialog.Cancel>
              <Button onClick={remove} disabled={busy} variant="destructive">
                {busy ? "Removing…" : "Remove"}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
