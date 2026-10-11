"use client";

import { useState, useTransition, type FormEvent } from "react";
import { removeAddress, saveAddress } from "@/app/(app)/dashboard/explorer/actions";
import { Button, FormError, Input } from "../ui";

export function RemoveSaved({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!confirming) {
    return (
      <Button variant="ghost" className="h-auto px-0 text-xs" onClick={() => setConfirming(true)}>
        Remove
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-3">
      <Button
        variant="danger"
        className="h-auto px-0 text-xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await removeAddress(id);
            if (!r.ok) setError(r.error);
          })
        }
      >
        {pending ? "Removing…" : "Confirm"}
      </Button>
      <Button variant="ghost" className="h-auto px-0 text-xs" onClick={() => setConfirming(false)}>
        Keep
      </Button>
      <FormError message={error} />
    </span>
  );
}

export function SaveAddress({ address, ensName, savedLabel }: { address: string; ensName: string | null; savedLabel: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const label = String(new FormData(e.currentTarget).get("label"));
    start(async () => {
      const r = await saveAddress({ address, label, ensName });
      if (r.ok) setOpen(false);
      else setError(r.error);
    });
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {savedLabel ? "Rename" : "Save address"}
      </Button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input name="label" aria-label="Label" defaultValue={savedLabel ?? ensName ?? ""} placeholder="Treasury, Hot wallet…" maxLength={48} required autoFocus />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <FormError message={error} />
    </form>
  );
}
