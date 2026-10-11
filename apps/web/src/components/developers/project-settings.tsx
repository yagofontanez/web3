"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateProject } from "@/app/(app)/dashboard/developers/actions";
import { Button, FormError } from "../ui";

const input = "h-10 rounded-md border border-line bg-paper px-3 text-sm placeholder:text-muted focus:border-verdigris focus:outline-none disabled:opacity-60";

export function ProjectDetailsForm({ projectId, name, description, editable }: { projectId: string; name: string; description: string | null; editable: boolean }) {
  const [values, setValues] = useState({ name, description: description ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const dirty = values.name.trim() !== name || values.description.trim() !== (description ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await updateProject(projectId, values);
      if (!r.ok) return setError(r.error);
      setSaved(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Name</span>
        <input
          className={input}
          value={values.name}
          disabled={!editable}
          required
          minLength={2}
          maxLength={48}
          onChange={(e) => {
            setValues((v) => ({ ...v, name: e.target.value }));
            setSaved(false);
          }}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">
          Description <span className="font-normal text-muted">(optional)</span>
        </span>
        <input
          className={input}
          value={values.description}
          disabled={!editable}
          maxLength={200}
          placeholder="What calls the API with these keys?"
          onChange={(e) => {
            setValues((v) => ({ ...v, description: e.target.value }));
            setSaved(false);
          }}
        />
      </label>
      <FormError message={error} />
      {editable ? (
        <div>
          <Button type="submit" variant={dirty ? "primary" : "secondary"} disabled={!dirty || pending}>
            {pending ? "Saving…" : saved && !dirty ? "Saved" : "Save changes"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">Only admins, owners and developers can edit projects.</p>
      )}
    </form>
  );
}
