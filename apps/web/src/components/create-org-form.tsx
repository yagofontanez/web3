"use client";

import { useState, type FormEvent } from "react";
import { slugify } from "@w3s/shared";
import { authClient } from "@/lib/auth-client";
import { reloadTo } from "@/lib/navigation";
import { Button, Field, FormError, Input } from "./ui";

export function CreateOrgForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const slug = slugify(name);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { data, error } = await authClient.organization.create({ name, slug });
    if (error || !data) {
      setPending(false);
      setError(error?.code === "ORGANIZATION_ALREADY_EXISTS" ? "That name is already taken. If the organization is yours, open it from the list above." : (error?.message ?? "Could not create the organization."));
      return;
    }
    const active = await authClient.organization.setActive({ organizationId: data.id });
    if (active.error) {
      setPending(false);
      setError("The organization was created, but we couldn't open it. Reload the page and pick it from the list.");
      return;
    }
    reloadTo("/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Organization name" hint={slug ? `systema.app/${slug}` : "Your company or team name."}>
        <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={64} autoFocus />
      </Field>
      <FormError message={error} />
      <Button type="submit" disabled={pending || slug.length < 2}>
        {pending ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}

export function ExistingOrgs({ orgs }: { orgs: { id: string; name: string; slug: string }[] }) {
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(id: string) {
    setOpening(id);
    setError(null);
    const { error } = await authClient.organization.setActive({ organizationId: id });
    if (error) {
      setOpening(null);
      return setError(error.message ?? "Couldn't open that organization.");
    }
    reloadTo("/dashboard");
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Your organizations</h2>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {orgs.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{o.name}</span>
              <span className="truncate font-mono text-xs text-muted">{o.slug}</span>
            </div>
            <Button variant="secondary" onClick={() => open(o.id)} disabled={opening !== null}>
              {opening === o.id ? "Opening…" : "Open"}
            </Button>
          </li>
        ))}
      </ul>
      <FormError message={error} />
    </div>
  );
}
