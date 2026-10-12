"use client";

import { AlertDialog } from "radix-ui";
import { useEffect, useState, useTransition } from "react";
import { deleteContract, refreshVerification, verifyContract } from "@/app/(app)/dashboard/contracts/actions";
import { reloadTo } from "@/lib/navigation";
import { Button } from "../ui";

export function VerifyButton({ id, state }: { id: string; state: "unverified" | "pending" | "verified" | "failed" }) {
  const [current, setCurrent] = useState(state);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (current !== "pending") return;
    const t = setInterval(async () => {
      const r = await refreshVerification(id);
      if (r.ok && r.data.state !== "pending") setCurrent(r.data.state as typeof current);
    }, 5000);
    return () => clearInterval(t);
  }, [current, id]);

  if (current === "verified") return null;
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        disabled={pending || current === "pending"}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await verifyContract(id);
            if (!r.ok) return setError(r.error);
            setCurrent("pending");
          })
        }
      >
        {current === "pending" ? "Verifying…" : current === "failed" ? "Retry verification" : "Verify source"}
      </Button>
      {error ? <span className="max-w-xs text-xs text-danger">{error}</span> : null}
    </div>
  );
}

export function RemoveContract({ id, name, deployed }: { id: string; name: string; deployed: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <Button variant="secondary" className="text-danger">
          Remove from studio
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-line bg-surface p-6 text-ink shadow-2xl">
          <AlertDialog.Title className="text-lg font-semibold">Remove {name}?</AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted">
            {deployed ? "This only removes it from your workspace. The contract stays on-chain forever and keeps working." : "The draft and its compiled code are deleted."}
          </AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteContract(id);
                  if (r.ok) reloadTo("/dashboard/contracts");
                })
              }
            >
              {pending ? "Removing…" : "Remove"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
