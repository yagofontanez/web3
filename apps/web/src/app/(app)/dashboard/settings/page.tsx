import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db, schema } from "@w3s/db";
import { InvitationControls, InviteForm, MemberControls, RenameOrgForm } from "@/components/org-settings";
import { Badge, Mono } from "@/components/ui";
import { requireOrg } from "@/lib/dal";

export const metadata: Metadata = { title: "Organization" };

const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default function SettingsPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Organization</h1>
        <Suspense fallback={<p className="h-5" />}>
          <OrgMeta />
        </Suspense>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">Loading organization…</p>}>
        <OrgSettings />
      </Suspense>
    </div>
  );
}

async function OrgMeta() {
  const { org } = await requireOrg();
  return (
    <p className="text-sm text-muted">
      <Mono>{org.slug}</Mono>, created {dateFmt.format(new Date(org.createdAt))}
    </p>
  );
}

async function OrgSettings() {
  const { org, user, role, can } = await requireOrg();
  const canManageMembers = can({ member: ["update"] });
  const canInvite = can({ invitation: ["create"] });
  const isOwner = role === "owner";
  const pending = org.invitations.filter((i) => i.status === "pending");

  const auditRows = can({ audit: ["read"] })
    ? await db
        .select({
          id: schema.auditLog.id,
          action: schema.auditLog.action,
          metadata: schema.auditLog.metadata,
          createdAt: schema.auditLog.createdAt,
          actor: schema.user.email,
        })
        .from(schema.auditLog)
        .leftJoin(schema.user, eq(schema.auditLog.actorId, schema.user.id))
        .where(and(eq(schema.auditLog.organizationId, org.id)))
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(25)
    : null;

  return (
    <>

      {can({ organization: ["update"] }) ? (
        <section className="flex flex-col gap-4">
          <RenameOrgForm organizationId={org.id} name={org.name} />
        </section>
      ) : null}

      <section aria-labelledby="members" className="flex flex-col gap-4">
        <h2 id="members" className="text-lg font-semibold tracking-tight">
          Members
        </h2>
        {canInvite ? <InviteForm organizationId={org.id} canInviteOwner={isOwner} /> : null}
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {org.members.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">
                  {m.user.name || m.user.email}
                  {m.userId === user.id ? <span className="font-normal text-muted"> (you)</span> : null}
                </span>
                <span className="truncate text-sm text-muted">{m.user.email}</span>
              </div>
              {canManageMembers && m.userId !== user.id && (m.role !== "owner" || isOwner) ? (
                <MemberControls organizationId={org.id} memberId={m.id} role={m.role} canInviteOwner={isOwner} />
              ) : (
                <Badge tone={m.role === "owner" ? "live" : "neutral"}>{m.role}</Badge>
              )}
            </li>
          ))}
        </ul>

        {pending.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Waiting to accept</h3>
            <ul className="divide-y divide-line rounded-lg border border-dashed border-line">
              {pending.map((i) => (
                <li key={i.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm">{i.email}</span>
                    <span className="text-xs text-muted">
                      {i.role}, expires {dateFmt.format(new Date(i.expiresAt))}
                    </span>
                  </div>
                  {canInvite ? <InvitationControls invitationId={i.id} canCancel={can({ invitation: ["cancel"] })} /> : null}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">
              Email delivery isn&apos;t set up yet. Copy the link and send it to your teammate yourself.
            </p>
          </div>
        ) : null}
      </section>

      {auditRows ? (
        <section aria-labelledby="audit" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="audit" className="text-lg font-semibold tracking-tight">
              Audit log
            </h2>
            <p className="text-sm text-muted">Membership and access changes in this organization, newest first.</p>
          </div>
          {auditRows.length === 0 ? (
            <p className="text-sm text-muted">Nothing recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Event</th>
                    <th className="px-4 py-2 font-medium">By</th>
                    <th className="px-4 py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {auditRows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">
                        <Mono>{r.action}</Mono>
                        {r.metadata ? <span className="ml-2 text-muted">{describe(r.metadata)}</span> : null}
                      </td>
                      <td className="px-4 py-2 text-muted">{r.actor ?? "System"}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-muted">{dateFmt.format(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}

function describe(meta: Record<string, unknown>) {
  if (typeof meta.from === "string" && typeof meta.to === "string") return `${meta.from} to ${meta.to}`;
  return [meta.email, meta.role].filter(Boolean).join(" as ");
}
