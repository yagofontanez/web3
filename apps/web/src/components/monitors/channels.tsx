"use client";

import { useRouter } from "next/navigation";
import { AlertDialog, Dialog } from "radix-ui";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { createTelegramLink, createWebhook, removeChannel, testChannel } from "@/app/(app)/dashboard/monitors/actions";
import { CodeBlock } from "../developers/code-block";
import { Button, FormError } from "../ui";

const overlay = "fixed inset-0 z-50 bg-black/40";
const panel =
  "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-xl border border-line bg-surface p-6 text-ink shadow-2xl";
const input = "h-10 rounded-md border border-line bg-paper px-3 text-sm placeholder:text-muted focus:border-verdigris focus:outline-none";

export function TelegramIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#2AABEE" />
      <path d="M5.4 11.8 16.9 7.3c.5-.2 1 .1.8.9l-2 9.3c-.1.6-.5.8-1 .5l-3-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5c.2-.2 0-.4-.4-.2l-6.9 4.4-3-.9c-.6-.2-.7-.6.2-.9Z" fill="#fff" />
    </svg>
  );
}

export function WebhookIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.5 8.5a3.5 3.5 0 1 1 5.6 2.8L13 15" />
      <path d="M7.4 13.9A3.5 3.5 0 1 0 11 19h5" />
      <path d="M16.6 13.4A3.5 3.5 0 1 1 15 20" />
    </svg>
  );
}

export function ConnectTelegram({ channelCount }: { channelCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<{ url: string; groupUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [baseline] = useState(channelCount);
  const connected = links !== null && channelCount > baseline;

  useEffect(() => {
    if (!open || !links || connected) return;
    const id = setInterval(() => router.refresh(), 2500);
    const stop = setTimeout(() => clearInterval(id), 5 * 60 * 1000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [open, links, connected, router]);

  function generate() {
    setError(null);
    start(async () => {
      const r = await createTelegramLink();
      if (!r.ok) return setError(r.error);
      setLinks({ url: r.data.url, groupUrl: r.data.groupUrl });
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !links) generate();
        if (!v) setLinks(null);
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="secondary" className="gap-2">
          <TelegramIcon className="size-4" />
          Connect Telegram
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={overlay} />
        <Dialog.Content className={panel}>
          <div className="flex items-center gap-3">
            <TelegramIcon className="size-9" />
            <div className="flex flex-col">
              <Dialog.Title className="text-lg font-semibold">{connected ? "Telegram connected" : "Connect Telegram"}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted">
                {connected ? "Pick it as a channel when you create or edit a monitor." : "Alerts go to a private chat or a group. The link works once and expires in 30 minutes."}
              </Dialog.Description>
            </div>
          </div>
          {connected ? (
            <div className="flex flex-col gap-4">
              <p className="rounded-lg bg-verdigris-soft/60 px-4 py-3 text-sm">The bot confirmed in the chat. You can send a test from the channel list.</p>
              <div className="flex justify-end">
                <Dialog.Close asChild>
                  <Button>Done</Button>
                </Dialog.Close>
              </div>
            </div>
          ) : (
            <>
              <ol className="flex flex-col gap-3 text-sm">
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-paper text-xs font-semibold ring-1 ring-line">1</span>
                  <span>Open the bot in Telegram, for yourself or for a group.</span>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-paper text-xs font-semibold ring-1 ring-line">2</span>
                  <span>
                    Tap <b>Start</b>. In a group, pick the group and confirm.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-paper text-xs font-semibold ring-1 ring-line">3</span>
                  <span>This window updates by itself when the bot confirms.</span>
                </li>
              </ol>
              <FormError message={error} />
              <div className="grid gap-2 sm:grid-cols-2">
                <a
                  href={links?.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!links || pending}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2AABEE] px-4 text-sm font-medium text-white hover:opacity-90 ${!links ? "pointer-events-none opacity-50" : ""}`}
                >
                  Open in Telegram
                </a>
                <a
                  href={links?.groupUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex h-10 items-center justify-center rounded-md border border-line px-4 text-sm font-medium hover:border-muted ${!links ? "pointer-events-none opacity-50" : ""}`}
                >
                  Add to a group
                </a>
              </div>
              {links ? (
                <p className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
                  <span className="relative flex size-2" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-verdigris opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-verdigris" />
                  </span>
                  Waiting for you to press Start…
                </p>
              ) : null}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const VERIFY = `import crypto from "node:crypto";

export function verify(req, rawBody, secret) {
  const header = req.headers["x-systema-signature"]; // t=…,v1=…
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
}`;

export function AddWebhook() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await createWebhook({ name: String(f.get("name")), url: String(f.get("url")) });
      if (!r.ok) return setError(r.error);
      setSecret(r.data.secret);
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          if (secret) router.refresh();
          setSecret(null);
          setError(null);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="secondary" className="gap-2">
          <WebhookIcon className="size-4" />
          Add webhook
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={overlay} />
        <Dialog.Content className={panel} onInteractOutside={(e) => secret && e.preventDefault()}>
          {secret ? (
            <>
              <div className="flex flex-col gap-1">
                <Dialog.Title className="text-lg font-semibold">Save your signing secret</Dialog.Title>
                <Dialog.Description className="text-sm text-muted">
                  Every request carries an <span className="font-mono text-ink">x-systema-signature</span> header made with this secret. It&apos;s shown
                  once.
                </Dialog.Description>
              </div>
              <CodeBlock code={secret} label="Signing secret" wrap />
              <CodeBlock code={VERIFY} label="Verify it in Node.js" />
              <div className="flex justify-end">
                <Dialog.Close asChild>
                  <Button>Done</Button>
                </Dialog.Close>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <Dialog.Title className="text-lg font-semibold">Add a webhook</Dialog.Title>
                <Dialog.Description className="text-sm text-muted">
                  We POST a signed JSON body to this URL for every alert, and retry up to 6 times with backoff if it fails.
                </Dialog.Description>
              </div>
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Name</span>
                  <input name="name" required minLength={2} maxLength={60} placeholder="Treasury service" className={input} autoFocus />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">URL</span>
                  <input name="url" type="url" required placeholder="https://api.yourcompany.com/hooks/systema" className={`${input} font-mono`} />
                </label>
                <FormError message={error} />
                <div className="flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <Button type="button" variant="secondary">
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Adding…" : "Add webhook"}
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

export function ChannelActions({ id, name, canManage }: { id: string; name: string; canManage: boolean }) {
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [removing, startRemove] = useTransition();
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          className="h-8 px-2 text-xs"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await testChannel(id);
              setState(r.ok ? { ok: true, text: "Test delivered" } : { ok: false, text: r.error });
            })
          }
        >
          {pending ? "Sending…" : "Send test"}
        </Button>
        {canManage ? (
          <AlertDialog.Root open={confirm} onOpenChange={setConfirm}>
            <AlertDialog.Trigger asChild>
              <Button variant="ghost" className="h-8 px-2 text-xs hover:text-danger">
                Remove
              </Button>
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className={overlay} />
              <AlertDialog.Content className={panel}>
                <AlertDialog.Title className="text-lg font-semibold">Remove {name}?</AlertDialog.Title>
                <AlertDialog.Description className="text-sm text-muted">
                  Monitors stop sending to it right away. Past deliveries stay in the alert history.
                </AlertDialog.Description>
                <div className="flex justify-end gap-2">
                  <AlertDialog.Cancel asChild>
                    <Button variant="secondary">Cancel</Button>
                  </AlertDialog.Cancel>
                  <Button
                    variant="destructive"
                    disabled={removing}
                    onClick={() =>
                      startRemove(async () => {
                        await removeChannel(id);
                        setConfirm(false);
                      })
                    }
                  >
                    {removing ? "Removing…" : "Remove channel"}
                  </Button>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        ) : null}
      </div>
      {state ? <span className={`max-w-56 text-right text-xs ${state.ok ? "text-verdigris" : "text-danger"}`}>{state.text}</span> : null}
    </div>
  );
}
