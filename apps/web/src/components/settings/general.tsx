"use client";

import { useRouter } from "next/navigation";
import { AlertDialog } from "radix-ui";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { reloadTo } from "@/lib/navigation";
import { Button, FormError } from "../ui";

export function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2 rounded-md border border-line bg-paper py-1 pr-1 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-sm">{value}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded px-2 py-1 text-xs text-muted hover:bg-surface hover:text-ink"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export function NameField({ organizationId, name, editable }: { organizationId: string; name: string; editable: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = value.trim() !== name;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setError(null);
    setState("saving");
    const { error } = await authClient.organization.update({ organizationId, data: { name: value.trim() } });
    if (error) {
      setState("idle");
      return setError(error.message ?? "Could not save the name.");
    }
    setState("saved");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-1.5">
      <label htmlFor="org-name" className="text-sm font-medium">
        Name
      </label>
      <div className="flex gap-2">
        <input
          id="org-name"
          value={value}
          disabled={!editable}
          onChange={(e) => {
            setValue(e.target.value);
            setState("idle");
          }}
          required
          minLength={2}
          maxLength={64}
          className="h-10 min-w-0 flex-1 rounded-md border border-line bg-paper px-3 text-sm focus:border-verdigris focus:outline-none disabled:opacity-60"
        />
        {editable ? (
          <Button type="submit" variant={dirty ? "primary" : "secondary"} disabled={!dirty || state === "saving"} className="h-10">
            {state === "saving" ? "Saving…" : state === "saved" && !dirty ? "Saved" : "Save"}
          </Button>
        ) : null}
      </div>
      {!editable ? <span className="text-xs text-muted">Only owners and admins can rename the organization.</span> : null}
      <FormError message={error} />
    </form>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmWord,
  action,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  body: string;
  confirmWord?: string;
  action: string;
  onConfirm: () => Promise<string | null>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = !confirmWord || typed.trim() === confirmWord;

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        setTyped("");
        setError(null);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-line bg-surface p-6 text-ink shadow-2xl">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted">{body}</AlertDialog.Description>
          {confirmWord ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span>
                Type <span className="font-mono font-medium">{confirmWord}</span> to confirm
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoFocus
                className="h-10 rounded-md border border-line bg-paper px-3 font-mono text-sm focus:border-danger focus:outline-none"
              />
            </label>
          ) : null}
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <Button
              disabled={!ready || busy}
              variant="destructive"
              onClick={async () => {
                setBusy(true);
                const err = await onConfirm();
                setBusy(false);
                if (err) setError(err);
              }}
            >
              {busy ? "Working…" : action}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function DangerZone({
  organizationId,
  name,
  slug,
  canDelete,
  canLeave,
}: {
  organizationId: string;
  name: string;
  slug: string;
  canDelete: boolean;
  canLeave: boolean;
}) {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <section aria-labelledby="danger" className="flex flex-col gap-4">
      <h2 id="danger" className="text-lg font-semibold tracking-tight">
        Leave or delete
      </h2>
      <div className="divide-y divide-line rounded-xl border border-danger/40">
        {canLeave ? (
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Leave {name}</span>
              <span className="text-sm text-muted">You lose access right away. Someone will need to invite you back.</span>
            </div>
            <Button variant="secondary" className="shrink-0 text-danger" onClick={() => setLeaveOpen(true)}>
              Leave organization
            </Button>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">Delete {name}</span>
            <span className="text-sm text-muted">
              {canDelete
                ? "Removes the organization, its members, saved wallets and audit log for good."
                : "Only the owner can delete the organization."}
            </span>
          </div>
          <Button variant="secondary" className="shrink-0 text-danger" disabled={!canDelete} onClick={() => setDeleteOpen(true)}>
            Delete organization
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title={`Leave ${name}?`}
        body="You'll lose access to its wallets, keys and monitors. Your account stays."
        action="Leave"
        onConfirm={async () => {
          const { error } = await authClient.organization.leave({ organizationId });
          if (error) return error.message ?? "Could not leave the organization.";
          reloadTo("/onboarding");
          return null;
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${name}?`}
        body="This can't be undone. Every member loses access, and saved wallets and the audit log are erased."
        confirmWord={slug}
        action="Delete organization"
        onConfirm={async () => {
          const { error } = await authClient.organization.delete({ organizationId });
          if (error) return error.message ?? "Could not delete the organization.";
          reloadTo("/onboarding");
          return null;
        }}
      />
    </section>
  );
}
