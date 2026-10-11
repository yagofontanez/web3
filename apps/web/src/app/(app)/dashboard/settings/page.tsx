import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db, schema } from "@w3s/db";
import { roles, statements, type OrgRole } from "@w3s/shared/permissions";
import { OrgGlyph } from "@/components/org-glyph";
import { SectionTabs } from "@/components/section-tabs";
import { CopyField, DangerZone, NameField } from "@/components/settings/general";
import { InvitationActions } from "@/components/settings/invitation-row";
import { InviteForm } from "@/components/settings/invite-form";
import { MemberMenu } from "@/components/settings/member-menu";
import { ROLE_INFO, ROLE_ORDER } from "@/components/settings/roles";
import { describeAudit } from "@/lib/audit-describe";
import { requireOrg } from "@/lib/dal";
import { sinceNow } from "@/lib/format";

export const metadata: Metadata = { title: "Organization" };

type Props = PageProps<"/dashboard/settings">;

const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const dateTimeFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default function SettingsPage({ searchParams }: Props) {
  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <Suspense fallback={<div className="h-10 border-b border-line" />}>
        <Tabs />
      </Suspense>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Header() {
  const { org, role } = await requireOrg();
  const pending = org.invitations.filter((i) => i.status === "pending").length;
  return (
    <header className="flex items-center gap-5">
      <OrgGlyph id={org.id} className="size-16" />
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-3xl font-semibold tracking-[-0.02em]">{org.name}</h1>
        <p className="text-sm text-muted">
          {org.members.length} {org.members.length === 1 ? "member" : "members"}
          {pending ? `, ${pending} invited` : ""}. Created {dateFmt.format(new Date(org.createdAt))}. You&apos;re{" "}
          {role === "owner" || role === "admin" ? "an" : "a"} {role}.
        </p>
      </div>
    </header>
  );
}

async function Tabs() {
  const { org, can } = await requireOrg();
  const tabs = [
    { id: "general", label: "General" },
    { id: "members", label: "Members", count: org.members.length },
    { id: "roles", label: "Roles" },
    ...(can({ audit: ["read"] }) ? [{ id: "audit", label: "Audit log" }] : []),
  ];
  return <SectionTabs tabs={tabs} label="Organization sections" fallback="general" />;
}

async function Body({ searchParams }: Pick<Props, "searchParams">) {
  const tab = (await searchParams).tab;
  if (tab === "members") return <Members />;
  if (tab === "roles") return <Roles />;
  if (tab === "audit") return <Audit />;
  return <General />;
}

async function General() {
  const { org, role, can } = await requireOrg();
  const owners = org.members.filter((m) => m.role === "owner").length;
  const canLeave = role !== "owner" || owners > 1;
  return (
    <div className="flex max-w-3xl flex-col gap-12">
      <section aria-labelledby="profile" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 id="profile" className="text-lg font-semibold tracking-tight">
            Profile
          </h2>
          <p className="text-sm text-muted">How this organization shows up across the workspace.</p>
        </div>
        <div className="grid gap-5 rounded-xl border border-line bg-surface p-5">
          <NameField organizationId={org.id} name={org.name} editable={can({ organization: ["update"] })} />
          <div className="grid gap-5 sm:grid-cols-2">
            <CopyField label="Slug" value={org.slug} hint="Used in links. Set when the organization was created." />
            <CopyField label="Organization ID" value={org.id} hint="Include it when you contact support or call the API." />
          </div>
        </div>
      </section>
      <DangerZone organizationId={org.id} name={org.name} slug={org.slug} canDelete={can({ organization: ["delete"] })} canLeave={canLeave} />
    </div>
  );
}

async function Members() {
  const { org, user, role, can } = await requireOrg();
  const canManage = can({ member: ["update"] });
  const canInvite = can({ invitation: ["create"] });
  const isOwner = role === "owner";
  const pending = org.invitations.filter((i) => i.status === "pending");
  const members = [...org.members].sort((a, b) => ROLE_ORDER.indexOf(a.role as OrgRole) - ROLE_ORDER.indexOf(b.role as OrgRole));

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-8">
        <section aria-labelledby="people" className="flex flex-col gap-3">
          <h2 id="people" className="text-lg font-semibold tracking-tight">
            People
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {members.map((m) => {
              const name = m.user.name || m.user.email;
              const manageable = canManage && m.userId !== user.id && (m.role !== "owner" || isOwner);
              return (
                <li key={m.id} className="flex items-center gap-3.5 px-4 py-3.5">
                  <span
                    aria-hidden
                    className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                      m.userId === user.id ? "bg-ink text-paper" : "bg-paper ring-1 ring-line"
                    }`}
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {name}
                      {m.userId === user.id ? <span className="font-normal text-muted"> (you)</span> : null}
                    </span>
                    <span className="truncate text-xs text-muted">
                      {m.user.email}, joined {sinceNow(m.createdAt)}
                    </span>
                  </div>
                  {manageable ? (
                    <MemberMenu organizationId={org.id} memberId={m.id} name={name} role={m.role} canAssignOwner={isOwner} />
                  ) : (
                    <span className="rounded-md px-2.5 py-1 text-sm text-muted">{ROLE_INFO[m.role as OrgRole]?.label ?? m.role}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {pending.length > 0 ? (
          <section aria-labelledby="pending" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="pending" className="text-lg font-semibold tracking-tight">
                Waiting to join
              </h2>
              <p className="text-sm text-muted">Email isn&apos;t set up yet, so send each person their link yourself.</p>
            </div>
            <ul className="divide-y divide-line rounded-xl border border-dashed border-line">
              {pending.map((i) => (
                <li key={i.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{i.email}</span>
                    <span className="text-xs text-muted">
                      {ROLE_INFO[i.role as OrgRole]?.label ?? i.role}, link expires {dateTimeFmt.format(new Date(i.expiresAt))}
                    </span>
                  </div>
                  {canInvite ? <InvitationActions invitationId={i.id} canCancel={can({ invitation: ["cancel"] })} /> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-10">
        {canInvite ? (
          <InviteForm organizationId={org.id} canInviteOwner={isOwner} />
        ) : (
          <div className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">
            Only owners and admins can invite people. Ask one of them if someone needs access.
          </div>
        )}
      </div>
    </div>
  );
}

const RESOURCES: { key: keyof typeof statements; label: string }[] = [
  { key: "organization", label: "Organization settings" },
  { key: "member", label: "Members" },
  { key: "invitation", label: "Invitations" },
  { key: "address", label: "Saved wallets" },
  { key: "project", label: "Projects" },
  { key: "apiKey", label: "API keys" },
  { key: "monitor", label: "Monitors" },
  { key: "contract", label: "Contracts" },
  { key: "billing", label: "Billing" },
  { key: "audit", label: "Audit log" },
];

function allowed(role: OrgRole, resource: keyof typeof statements) {
  const actions = statements[resource] as readonly string[];
  const ok = actions.filter((a) => roles[role].authorize({ [resource]: [a] } as never).success);
  return { ok, all: ok.length === actions.length };
}

function describeActions(actions: string[]) {
  const label = actions.map((a) => a[0]!.toUpperCase() + a.slice(1)).join(", ");
  return actions.length === 1 ? `${label} only` : label;
}

async function Roles() {
  const { role: mine } = await requireOrg();
  return (
    <section aria-labelledby="matrix" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="matrix" className="text-lg font-semibold tracking-tight">
          What each role can do
        </h2>
        <p className="max-w-[64ch] text-sm text-muted">
          Read straight from the permissions the server enforces. Your role is highlighted.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium text-muted">Area</th>
              {ROLE_ORDER.map((r) => (
                <th key={r} className={`px-4 py-3 ${r === mine ? "bg-verdigris-soft/50" : ""}`}>
                  <span className="flex flex-col">
                    <span className="font-semibold">{ROLE_INFO[r].label}</span>
                    {r === mine ? <span className="text-xs font-normal text-verdigris">Your role</span> : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {RESOURCES.map(({ key, label }) => (
              <tr key={key}>
                <td className="px-4 py-2.5">{label}</td>
                {ROLE_ORDER.map((r) => {
                  const { ok, all } = allowed(r, key);
                  return (
                    <td key={r} className={`px-4 py-2.5 ${r === mine ? "bg-verdigris-soft/50" : ""}`}>
                      {ok.length === 0 ? (
                        <span className="text-muted" aria-label="No access">
                          —
                        </span>
                      ) : all ? (
                        <span className="font-medium text-verdigris">Full access</span>
                      ) : (
                        <span className="text-muted">{describeActions(ok)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function Audit() {
  const { org, can } = await requireOrg();
  if (!can({ audit: ["read"] })) return <p className="text-sm text-muted">Your role can&apos;t see the audit log.</p>;
  const rows = await db
    .select({
      id: schema.auditLog.id,
      action: schema.auditLog.action,
      metadata: schema.auditLog.metadata,
      createdAt: schema.auditLog.createdAt,
      actorName: schema.user.name,
      actorEmail: schema.user.email,
    })
    .from(schema.auditLog)
    .leftJoin(schema.user, eq(schema.auditLog.actorId, schema.user.id))
    .where(eq(schema.auditLog.organizationId, org.id))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(50);

  return (
    <section aria-labelledby="audit" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="audit" className="text-lg font-semibold tracking-tight">
          Audit log
        </h2>
        <p className="text-sm text-muted">Access and membership changes, newest first. Showing the last {rows.length} events.</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nothing recorded yet.</p>
      ) : (
        <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-6">
              <p className="text-sm">
                <span className="font-medium">{r.actorName || r.actorEmail || "System"}</span>{" "}
                <span className="text-muted">{describeAudit(r.action, r.metadata)}</span>
              </p>
              <p className="flex items-baseline gap-3 text-xs text-muted sm:justify-end">
                <span className="font-mono">{r.action}</span>
                <time dateTime={r.createdAt.toISOString()} title={dateTimeFmt.format(r.createdAt)}>
                  {sinceNow(r.createdAt)}
                </time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-5" aria-busy>
      <div className="size-16 animate-pulse rounded-md bg-line/60" />
      <div className="flex flex-col gap-2">
        <div className="h-8 w-56 animate-pulse rounded bg-line/60" />
        <div className="h-4 w-72 animate-pulse rounded bg-line/40" />
      </div>
    </div>
  );
}
