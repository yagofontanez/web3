"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { OrgRole } from "@w3s/shared/permissions";
import { authClient } from "@/lib/auth-client";
import { Button, Field, FormError, Input, Select } from "./ui";

const ROLE_HELP: Record<OrgRole, string> = {
  owner: "Full control, including billing and deleting the organization",
  admin: "Manages members and every resource",
  developer: "Creates projects, keys, monitors and deploys contracts",
  viewer: "Read-only access",
};

function RoleOptions({ includeOwner }: { includeOwner: boolean }) {
  return (
    <>
      {(Object.keys(ROLE_HELP) as OrgRole[])
        .filter((r) => includeOwner || r !== "owner")
        .map((r) => (
          <option key={r} value={r}>
            {r[0]!.toUpperCase() + r.slice(1)}
          </option>
        ))}
    </>
  );
}

export function RenameOrgForm({ organizationId, name }: { organizationId: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const { error } = await authClient.organization.update({
      organizationId,
      data: { name: String(new FormData(e.currentTarget).get("name")) },
    });
    if (error) return setError(error.message ?? "Could not save the name.");
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Field label="Organization name">
          <Input name="name" defaultValue={name} required minLength={2} maxLength={64} onChange={() => setSaved(false)} />
        </Field>
      </div>
      <Button type="submit" variant="secondary">
        {saved ? "Saved" : "Save name"}
      </Button>
      <FormError message={error} />
    </form>
  );
}

export function InviteForm({ organizationId, canInviteOwner }: { organizationId: string; canInviteOwner: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [role, setRole] = useState<OrgRole>("developer");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setError(null);
    setPending(true);
    const { error } = await authClient.organization.inviteMember({
      organizationId,
      email: String(new FormData(formEl).get("email")),
      role,
    });
    setPending(false);
    if (error) return setError(error.message ?? "Could not send the invitation.");
    formEl.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <Field label="Email">
          <Input name="email" type="email" required placeholder="teammate@company.com" />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
            <RoleOptions includeOwner={canInviteOwner} />
          </Select>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Invite"}
        </Button>
      </div>
      <p className="text-xs text-muted">{ROLE_HELP[role]}.</p>
      <FormError message={error} />
    </form>
  );
}

export function MemberControls({
  organizationId,
  memberId,
  role,
  canInviteOwner,
}: {
  organizationId: string;
  memberId: string;
  role: string;
  canInviteOwner: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        <Select
          aria-label="Role"
          defaultValue={role}
          onChange={async (e) => {
            setError(null);
            const { error } = await authClient.organization.updateMemberRole({
              organizationId,
              memberId,
              role: e.target.value as OrgRole,
            });
            if (error) setError(error.message ?? "Could not change the role.");
            router.refresh();
          }}
        >
          <RoleOptions includeOwner={canInviteOwner || role === "owner"} />
        </Select>
        {confirming ? (
          <Button
            variant="danger"
            className="px-0"
            onClick={async () => {
              const { error } = await authClient.organization.removeMember({ organizationId, memberIdOrEmail: memberId });
              if (error) setError(error.message ?? "Could not remove the member.");
              setConfirming(false);
              router.refresh();
            }}
          >
            Confirm removal
          </Button>
        ) : (
          <Button variant="ghost" className="px-0" onClick={() => setConfirming(true)}>
            Remove
          </Button>
        )}
      </div>
      <FormError message={error} />
    </div>
  );
}

export function InvitationControls({ invitationId, canCancel }: { invitationId: string; canCancel: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        className="px-0"
        onClick={async () => {
          await navigator.clipboard.writeText(`${window.location.origin}/accept-invitation/${invitationId}`);
          setCopied(true);
        }}
      >
        {copied ? "Link copied" : "Copy invite link"}
      </Button>
      {canCancel ? (
        <Button
          variant="danger"
          className="px-0"
          onClick={async () => {
            await authClient.organization.cancelInvitation({ invitationId });
            router.refresh();
          }}
        >
          Cancel
        </Button>
      ) : null}
    </div>
  );
}
