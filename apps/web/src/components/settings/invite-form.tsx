"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { OrgRole } from "@w3s/shared/permissions";
import { authClient } from "@/lib/auth-client";
import { Button, FormError } from "../ui";
import { ROLE_INFO, ROLE_ORDER } from "./roles";

export function InviteForm({ organizationId, canInviteOwner }: { organizationId: string; canInviteOwner: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<OrgRole>("developer");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const roles = ROLE_ORDER.filter((r) => canInviteOwner || r !== "owner");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(null);
    setPending(true);
    const { error } = await authClient.organization.inviteMember({ organizationId, email, role });
    setPending(false);
    if (error) return setError(error.message ?? "Could not create the invitation.");
    setSent(email);
    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">Invite someone</h3>
        <p className="text-sm text-muted">They get a link to join with the role you pick. You can change it later.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
          className="h-10 rounded-md border border-line bg-paper px-3 text-sm placeholder:text-muted focus:border-verdigris focus:outline-none"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">Role</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map((r) => (
            <label
              key={r}
              className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-verdigris ${
                role === r ? "border-verdigris bg-verdigris-soft/40" : "border-line hover:border-muted"
              }`}
            >
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
              <span className="flex items-center gap-2 text-sm font-medium">
                <span
                  aria-hidden
                  className={`size-3.5 shrink-0 rounded-full border ${role === r ? "border-[4.5px] border-verdigris" : "border-muted/50"}`}
                />
                {ROLE_INFO[r].label}
              </span>
              <span className="pl-5.5 text-xs leading-snug text-muted">{ROLE_INFO[r].summary}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating invitation…" : `Invite as ${ROLE_INFO[role].label.toLowerCase()}`}
        </Button>
        {sent ? <span className="text-sm text-verdigris">Invitation created for {sent}. Copy its link below.</span> : null}
      </div>
      <FormError message={error} />
    </form>
  );
}
