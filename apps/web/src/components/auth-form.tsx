"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { reloadTo } from "@/lib/navigation";
import { SiweButton } from "./siwe-button";
import { Button, Field, FormError, Input } from "./ui";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: String(form.get("name")) })
        : await authClient.signIn.email({ email, password });

    setPending(false);
    if (error) {
      setError(error.message ?? "Something went wrong. Try again.");
      return;
    }
    reloadTo(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === "sign-up" ? (
          <Field label="Name">
            <Input name="name" required autoComplete="name" />
          </Field>
        ) : null}
        <Field label="Work email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" hint={mode === "sign-up" ? "At least 10 characters." : undefined}>
          <Input
            name="password"
            type="password"
            required
            minLength={mode === "sign-up" ? 10 : undefined}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          />
        </Field>
        <FormError message={error} />
        <Button type="submit" disabled={pending}>
          {pending ? "One moment…" : mode === "sign-up" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <SiweButton next={next} />

      <p className="text-sm text-muted">
        {mode === "sign-up" ? "Already have an account? " : "New to Systema? "}
        <Link
          className="text-ink underline underline-offset-4"
          href={mode === "sign-up" ? `/sign-in?next=${encodeURIComponent(next)}` : `/sign-up?next=${encodeURIComponent(next)}`}
        >
          {mode === "sign-up" ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
