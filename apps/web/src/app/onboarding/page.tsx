import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { CreateOrgForm, ExistingOrgs } from "@/components/create-org-form";
import { auth } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { requireSession } from "@/lib/dal";

export const metadata: Metadata = { title: "Set up your organization" };

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-12">
      <Logo />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Set up your organization</h1>
        <p className="text-sm text-muted">
          Projects, API keys, monitors and contracts belong to an organization. You can invite teammates afterwards.
        </p>
      </div>
      <Suspense>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  await requireSession();
  const orgs = await auth.api.listOrganizations({ headers: await headers() });
  if (orgs.length === 0) return <CreateOrgForm />;
  return (
    <div className="flex flex-col gap-8">
      <ExistingOrgs orgs={orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug }))} />
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Or create another one</h2>
        <CreateOrgForm />
      </div>
    </div>
  );
}
