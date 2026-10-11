"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "../ui";

export function InvitationActions({ invitationId, canCancel }: { invitationId: string; canCancel: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [canceling, setCanceling] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        className="h-8 px-3 text-xs"
        onClick={async () => {
          await navigator.clipboard.writeText(`${window.location.origin}/accept-invitation/${invitationId}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? "Link copied" : "Copy link"}
      </Button>
      {canCancel ? (
        <Button
          variant="ghost"
          className="h-8 px-2 text-xs hover:text-danger"
          disabled={canceling}
          onClick={async () => {
            setCanceling(true);
            await authClient.organization.cancelInvitation({ invitationId });
            router.refresh();
          }}
        >
          {canceling ? "Canceling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}
