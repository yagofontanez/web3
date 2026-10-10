"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, FormError } from "./ui";

export function AcceptInvitation({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function respond(accept: boolean) {
    setPending(true);
    setError(null);
    const { data, error } = accept
      ? await authClient.organization.acceptInvitation({ invitationId })
      : await authClient.organization.rejectInvitation({ invitationId });
    if (error) {
      setPending(false);
      return setError(error.message ?? "This invitation is no longer valid.");
    }
    if (accept && data && "member" in data && data.member) {
      await authClient.organization.setActive({ organizationId: data.member.organizationId });
    }
    router.push(accept ? "/dashboard" : "/onboarding");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Join the organization</h1>
      <p className="text-sm text-muted">Accepting adds you as a member with the role you were invited with.</p>
      <div className="flex gap-3">
        <Button onClick={() => respond(true)} disabled={pending}>
          Accept invitation
        </Button>
        <Button variant="secondary" onClick={() => respond(false)} disabled={pending}>
          Decline
        </Button>
      </div>
      <FormError message={error} />
    </div>
  );
}
