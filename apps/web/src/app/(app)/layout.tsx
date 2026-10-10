import { headers } from "next/headers";
import { Suspense } from "react";
import { OrgSwitcher, SignOutButton } from "@/components/account-menu";
import { Logo } from "@/components/logo";
import { Nav } from "@/components/nav";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/dal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex flex-col gap-4 border-b border-line px-4 py-4 md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:gap-6 md:border-r md:border-b-0">
        <Logo href="/dashboard" />
        <Suspense fallback={<div className="h-9 rounded-md border border-line" />}>
          <Account />
        </Suspense>
        <Nav />
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 md:px-10">{children}</main>
    </div>
  );
}

async function Account() {
  const session = await getSession();
  if (!session) return null;
  const orgs = await auth.api.listOrganizations({ headers: await headers() });
  return (
    <div className="flex flex-col gap-2">
      <OrgSwitcher orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} activeId={session.session.activeOrganizationId ?? null} />
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="truncate" title={session.user.email}>
          {session.user.name || session.user.email}
        </span>
        <SignOutButton />
      </div>
    </div>
  );
}
