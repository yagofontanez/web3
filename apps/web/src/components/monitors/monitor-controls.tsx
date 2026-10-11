"use client";

import { AlertDialog } from "radix-ui";
import { useState, useTransition } from "react";
import { deleteMonitor, sendTestAlert, setMonitorEnabled } from "@/app/(app)/dashboard/monitors/actions";
import { reloadTo } from "@/lib/navigation";
import { Button } from "../ui";

export function EnabledSwitch({ id, enabled, disabled }: { id: string; enabled: boolean; disabled?: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Pause monitor" : "Resume monitor"}
      disabled={disabled || pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !on;
        setOn(next);
        start(async () => {
          const r = await setMonitorEnabled(id, next);
          if (!r.ok) setOn(!next);
        });
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? "bg-verdigris" : "bg-line"}`}
    >
      <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4.5" : "translate-x-0.5"}`} />
    </button>
  );
}

export function TestAlertButton({ id }: { id: string }) {
  const [results, setResults] = useState<{ channel: string; ok: boolean; error: string | null }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await sendTestAlert(id);
            if (!r.ok) {
              setResults(null);
              return setError(r.error);
            }
            setResults(r.data.results);
          })
        }
      >
        {pending ? "Sending test…" : "Send test alert"}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {results ? (
        <ul className="flex flex-col gap-1 text-sm" aria-live="polite">
          {results.map((r) => (
            <li key={r.channel} className={r.ok ? "text-verdigris" : "text-danger"}>
              {r.ok ? "✓" : "✕"} {r.channel}
              {r.error ? <span className="text-muted">: {r.error}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function DeleteMonitorButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <Button variant="secondary" className="text-danger">
          Delete monitor
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-line bg-surface p-6 text-ink shadow-2xl">
          <AlertDialog.Title className="text-lg font-semibold">Delete {name}?</AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted">It stops watching right away and its alert history is erased. Pause it instead if you might need it again.</AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteMonitor(id);
                  if (r.ok) reloadTo("/dashboard/monitors");
                })
              }
            >
              {pending ? "Deleting…" : "Delete monitor"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
