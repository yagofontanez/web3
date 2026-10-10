import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted">You&apos;ll set up an organization for your team next.</p>
      </div>
      <Suspense>
        <AuthForm mode="sign-up" />
      </Suspense>
    </>
  );
}
