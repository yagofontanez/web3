import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { roles, type OrgRole } from "@w3s/shared/permissions";
import { auth } from "./auth";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

export const requireOrg = cache(async () => {
  const session = await requireSession();
  const orgId = session.session.activeOrganizationId;
  if (!orgId) redirect("/onboarding");

  const org = await auth.api.getFullOrganization({
    headers: await headers(),
    query: { organizationId: orgId },
  });
  if (!org) redirect("/onboarding");

  const me = org.members.find((m) => m.userId === session.user.id);
  if (!me) redirect("/onboarding");

  const role = me.role as OrgRole;
  const can = (permissions: Parameters<(typeof roles)[OrgRole]["authorize"]>[0]) =>
    roles[role]?.authorize(permissions).success ?? false;

  return { session, user: session.user, org, role, can };
});
