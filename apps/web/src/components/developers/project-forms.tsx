"use client";

import { useRouter } from "next/navigation";
import { AlertDialog, Dialog } from "radix-ui";
import { useState, useTransition, type FormEvent } from "react";
import { archiveProject, createApiKey, createProject, revokeApiKey } from "@/app/(app)/dashboard/developers/actions";
import { reloadTo } from "@/lib/navigation";
import { Button, FormError } from "../ui";
import { CodeBlock } from "./code-block";

const overlay = "fixed inset-0 z-50 bg-black/40";
const panel =
  "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-xl border border-line bg-surface p-6 text-ink shadow-2xl";
const input = "h-10 rounded-md border border-line bg-paper px-3 text-sm placeholder:text-muted focus:border-verdigris focus:outline-none";

export function NewProjectButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await createProject({ name: String(form.get("name")), description: String(form.get("description") ?? "") });
      if (!r.ok) return setError(r.error);
      setOpen(false);
      router.push(`/dashboard/developers/${r.data.id}`);
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant={variant}>New project</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={overlay} />
        <Dialog.Content className={panel}>
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-lg font-semibold">New project</Dialog.Title>
            <Dialog.Description className="text-sm text-muted">
              A project groups the API keys and usage of one app, like your production backend or a staging bot.
            </Dialog.Description>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Name</span>
              <input name="name" required minLength={2} maxLength={48} autoFocus placeholder="Treasury dashboard" className={input} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Description <span className="font-normal text-muted">(optional)</span>
              </span>
              <input name="description" maxLength={200} placeholder="What will call the API?" className={input} />
            </label>
            <FormError message={error} />
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create project"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const LIMITS = [
  { value: 60, label: "60 / min", hint: "Scripts and prototypes" },
  { value: 120, label: "120 / min", hint: "Most backends" },
  { value: 600, label: "600 / min", hint: "High-traffic services" },
];

export function NewKeyButton({ projectId, baseUrl }: { projectId: string; baseUrl: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(120);
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [acknowledged, setAcknowledged] = useState(false);

  function reset(next: boolean) {
    if (!next && created) router.refresh();
    setOpen(next);
    if (!next) {
      setCreated(null);
      setError(null);
      setAcknowledged(false);
      setLimit(120);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name"));
    setError(null);
    start(async () => {
      const r = await createApiKey({ projectId, name, rateLimitPerMinute: limit });
      if (!r.ok) return setError(r.error);
      setCreated({ key: r.data.key, name });
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={reset}>
      <Dialog.Trigger asChild>
        <Button>Create key</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={overlay} />
        <Dialog.Content className={panel} onInteractOutside={(e) => created && e.preventDefault()}>
          {created ? (
            <>
              <div className="flex flex-col gap-1">
                <Dialog.Title className="text-lg font-semibold">Copy your key now</Dialog.Title>
                <Dialog.Description className="text-sm text-muted">
                  This is the only time {created.name} is shown in full. We store a fingerprint of it, not the key, so it can&apos;t
                  be recovered. If you lose it, revoke it and create another.
                </Dialog.Description>
              </div>
              <CodeBlock code={created.key} label="API key" wrap />
              <CodeBlock
                wrap
                label="Try it"
                code={`curl ${baseUrl}/v1/addresses/vitalik.eth/portfolio \\\n  -H "Authorization: Bearer ${created.key}"`}
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="accent-[var(--verdigris)]" />
                I saved this key somewhere safe
              </label>
              <div className="flex justify-end">
                <Button onClick={() => reset(false)} disabled={!acknowledged}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <Dialog.Title className="text-lg font-semibold">Create an API key</Dialog.Title>
                <Dialog.Description className="text-sm text-muted">Use a separate key per environment so you can revoke one without touching the others.</Dialog.Description>
              </div>
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Name</span>
                  <input name="name" required minLength={2} maxLength={48} autoFocus placeholder="Production backend" className={input} />
                </label>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1.5 text-sm font-medium">Rate limit</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {LIMITS.map((l) => (
                      <label
                        key={l.value}
                        className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-verdigris ${
                          limit === l.value ? "border-verdigris bg-verdigris-soft/40" : "border-line hover:border-muted"
                        }`}
                      >
                        <input type="radio" name="limit" className="sr-only" checked={limit === l.value} onChange={() => setLimit(l.value)} />
                        <span className="font-mono text-sm font-medium">{l.label}</span>
                        <span className="text-xs text-muted">{l.hint}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <FormError message={error} />
                <div className="flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <Button type="button" variant="secondary">
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Creating…" : "Create key"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Confirm({
  trigger,
  title,
  body,
  action,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  body: string;
  action: string;
  onConfirm: () => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content className={panel}>
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted">{body}</AlertDialog.Description>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const err = await onConfirm();
                  if (err) setError(err);
                  else setOpen(false);
                })
              }
            >
              {pending ? "Working…" : action}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function RevokeKeyButton({ keyId, name }: { keyId: string; name: string }) {
  return (
    <Confirm
      trigger={
        <Button variant="ghost" className="h-8 px-2 text-xs hover:text-danger">
          Revoke
        </Button>
      }
      title={`Revoke ${name}?`}
      body="Requests using this key start failing with 401 within seconds. This can't be undone."
      action="Revoke key"
      onConfirm={async () => {
        const r = await revokeApiKey(keyId);
        return r.ok ? null : r.error;
      }}
    />
  );
}

export function ArchiveProjectButton({ projectId, name }: { projectId: string; name: string }) {
  return (
    <Confirm
      trigger={
        <Button variant="secondary" className="text-danger">
          Archive project
        </Button>
      }
      title={`Archive ${name}?`}
      body="Every key in this project is revoked right away, and the project disappears from the list. Usage history stays in your logs."
      action="Archive project"
      onConfirm={async () => {
        const r = await archiveProject(projectId);
        if (!r.ok) return r.error;
        reloadTo("/dashboard/developers");
        return null;
      }}
    />
  );
}
