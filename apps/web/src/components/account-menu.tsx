"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button, Select } from "./ui";

type Org = { id: string; name: string };

export function OrgSwitcher({ orgs, activeId }: { orgs: Org[]; activeId: string | null }) {
  const router = useRouter();
  return (
    <Select
      aria-label="Active organization"
      value={activeId ?? ""}
      className="w-full"
      onChange={async (e) => {
        if (e.target.value === "__new") return router.push("/onboarding");
        await authClient.organization.setActive({ organizationId: e.target.value });
        router.refresh();
      }}
    >
      {orgs.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
      <option value="__new">New organization…</option>
    </Select>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      className="h-auto px-0"
      onClick={async () => {
        await authClient.signOut();
        router.push("/sign-in");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
