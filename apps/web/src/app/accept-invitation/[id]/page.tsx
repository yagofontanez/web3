import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AcceptInvitation } from "@/components/accept-invitation";
import { Logo } from "@/components/logo";
import { getSession } from "@/lib/dal";

export const metadata: Metadata = { title: "Join organization" };

export default function Page({ params }: PageProps<"/accept-invitation/[id]">) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-12">
      <Logo />
      <Suspense fallback={<p className="text-sm text-muted">Loading invitation…</p>}>
        <Invitation params={params} />
      </Suspense>
    </div>
  );
}

async function Invitation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const next = encodeURIComponent(`/accept-invitation/${id}`);

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;ve been invited</h1>
        <p className="text-sm text-muted">Sign in or create an account with the email address the invitation was sent to.</p>
        <div className="flex gap-3 text-sm">
          <Link className="underline underline-offset-4" href={`/sign-in?next=${next}`}>
            Sign in
          </Link>
          <Link className="underline underline-offset-4" href={`/sign-up?next=${next}`}>
            Create account
          </Link>
        </div>
      </div>
    );
  }
  return <AcceptInvitation invitationId={id} />;
}
