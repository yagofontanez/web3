import { headers } from "next/headers";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { Nav, NavLinks } from "@/components/nav";
import { CollapseToggle } from "@/components/shell/collapse-toggle";
import { applySidebarState, InlineScript } from "@/components/shell/inline-script";
import { OrgMenu } from "@/components/shell/org-menu";
import { UserMenu } from "@/components/shell/user-menu";
import { auth } from "@/lib/auth";
import { getSession, requireOrg } from "@/lib/dal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <InlineScript html={applySidebarState} />
      <aside className="flex flex-col gap-3 border-b border-line px-4 py-3 md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:gap-5 md:border-r md:border-b-0 md:px-3 md:py-4 md:transition-[width] md:duration-200 collapsed:md:w-[4.25rem]">
        <div className="flex items-center justify-between gap-2 md:px-1.5 collapsed:md:flex-col collapsed:md:gap-3 collapsed:md:px-0">
          <Logo href="/dashboard" labelClassName="collapsed:md:hidden" />
          <CollapseToggle />
        </div>
        <Suspense fallback={<div className="h-11 rounded-lg bg-surface/60" />}>
          <OrgBlock />
        </Suspense>
        <Suspense fallback={<NavLinks pathname="" />}>
          <Nav />
        </Suspense>
        <div className="hidden md:mt-auto md:block md:border-t md:border-line md:pt-3">
          <Suspense>
            <UserBlock />
          </Suspense>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 md:px-10 md:py-10">{children}</main>
    </div>
  );
}

async function OrgBlock() {
  const { org, role } = await requireOrg();
  const orgs = await auth.api.listOrganizations({ headers: await headers() });
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <OrgMenu orgs={orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug }))} activeId={org.id} role={role} />
      </div>
      <div className="md:hidden">
        <Suspense>
          <UserBlock compact />
        </Suspense>
      </div>
    </div>
  );
}

async function UserBlock({ compact = false }: { compact?: boolean }) {
  const session = await getSession();
  if (!session) return null;
  const { user } = session;
  return (
    <div className={compact ? "w-11" : ""}>
      <UserMenu name={user.name || user.email} email={user.email} />
    </div>
  );
}
