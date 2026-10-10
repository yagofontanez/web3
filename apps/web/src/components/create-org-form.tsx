"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { slugify } from "@w3s/shared";
import { authClient } from "@/lib/auth-client";
import { Button, Field, FormError, Input } from "./ui";

export function CreateOrgForm() {
  const router = useRouter();
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
      setError(error?.code === "ORGANIZATION_ALREADY_EXISTS" ? "That URL is taken. Try a different name." : (error?.message ?? "Could not create the organization."));
      return;
    }
    await authClient.organization.setActive({ organizationId: data.id });
    router.push("/dashboard");
    router.refresh();
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
