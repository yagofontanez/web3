import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CodeBlock } from "@/components/developers/code-block";
import { ArchiveProjectButton, NewKeyButton, RevokeKeyButton } from "@/components/developers/project-forms";
import { StatTile, UsageChart } from "@/components/developers/usage-chart";
import { SectionTabs } from "@/components/section-tabs";
import { CopyField } from "@/components/settings/general";
import { requireOrg } from "@/lib/dal";
import { API_BASE_URL, dailyUsage, getProject, listKeys, recentRequests, topRoutes, usageSummary } from "@/lib/developer";
import { sinceNow } from "@/lib/format";

export const metadata: Metadata = { title: "Project" };

type Props = PageProps<"/dashboard/developers/[projectId]">;

const timeFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function ProjectPage({ params, searchParams }: Props) {
  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <Link href="/dashboard/developers" className="w-fit text-sm text-muted hover:text-ink">
        API &amp; keys
      </Link>
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-line/40" />}>
        <Body params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ params, searchParams }: Props) {
  const [{ projectId }, sp, { org }] = await Promise.all([params, searchParams, requireOrg()]);
  const project = await getProject(org.id, projectId);
  if (!project) notFound();
  const tab = typeof sp.tab === "string" ? sp.tab : "keys";

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{project.name}</h1>
        <p className="text-sm text-muted">
          {project.description ? `${project.description}. ` : ""}Created {sinceNow(project.createdAt)}.
        </p>
      </header>
      <SectionTabs
        label="Project sections"
        fallback="keys"
        tabs={[
          { id: "keys", label: "Keys" },
          { id: "usage", label: "Usage" },
          { id: "logs", label: "Logs" },
          { id: "settings", label: "Settings" },
        ]}
      />
      <Suspense key={tab + String(sp.status ?? "")} fallback={<p className="text-sm text-muted">Loading…</p>}>
        {tab === "usage" ? (
          <Usage organizationId={org.id} projectId={project.id} />
        ) : tab === "logs" ? (
          <Logs organizationId={org.id} projectId={project.id} errorsOnly={sp.status === "errors"} />
        ) : tab === "settings" ? (
          <Settings projectId={project.id} name={project.name} />
        ) : (
          <Keys projectId={project.id} />
        )}
      </Suspense>
    </>
  );
}

async function Keys({ projectId }: { projectId: string }) {
  const { can } = await requireOrg();
  const keys = await listKeys(projectId);
  const active = keys.filter((k) => !k.revokedAt);
  const canRevoke = can({ apiKey: ["revoke"] });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">API keys</h2>
          <p className="text-sm text-muted">
            {active.length === 1 ? "1 active key" : `${active.length} active keys`}. Send one as <span className="font-mono text-ink">Authorization: Bearer …</span>
          </p>
        </div>
        {can({ apiKey: ["create"] }) ? <NewKeyButton projectId={projectId} baseUrl={API_BASE_URL} /> : null}
      </div>
      {keys.length === 0 ? (
        <div className="grid gap-6 rounded-xl border border-dashed border-line p-6 lg:grid-cols-2 lg:items-center">
          <p className="text-sm text-muted">No keys yet. Create one, copy it, and try the request on the right. It&apos;ll show up under Logs.</p>
          <CodeBlock code={`curl ${API_BASE_URL}/v1/networks \\\n  -H "Authorization: Bearer w3s_live_…"`} />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Key</th>
                <th className="px-4 py-2.5 font-medium">Limit</th>
                <th className="px-4 py-2.5 font-medium">Last used</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keys.map((k) => (
                <tr key={k.id} className={k.revokedAt ? "text-muted" : ""}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className={`size-1.5 rounded-full ${k.revokedAt ? "bg-muted/50" : "bg-verdigris"}`} />
                      <span className={k.revokedAt ? "line-through decoration-line" : "font-medium"}>{k.name}</span>
                      {k.revokedAt ? <span className="text-xs">revoked {sinceNow(k.revokedAt)}</span> : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{k.prefix}…</td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums">{k.rateLimitPerMinute}/min</td>
                  <td className="px-4 py-3">{k.lastUsedAt ? sinceNow(k.lastUsedAt) : <span className="text-muted">never</span>}</td>
                  <td className="px-4 py-3 text-muted">
                    {sinceNow(k.createdAt)}
                    {k.createdBy ? ` by ${k.createdBy}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right">{!k.revokedAt && canRevoke ? <RevokeKeyButton keyId={k.id} name={k.name} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function Usage({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const scope = { organizationId, projectId };
  const [day, week, series, routes] = await Promise.all([usageSummary(scope, 1), usageSummary(scope, 7), dailyUsage(scope, 14), topRoutes(scope, 7)]);
  const rate = (s: { requests: number; errors: number }) => (s.requests ? (s.errors / s.requests) * 100 : 0);
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-6 rounded-xl border border-line bg-surface p-6 md:grid-cols-4">
        <StatTile label="Requests, 24h" value={day.requests.toLocaleString("en")} sub={`${week.requests.toLocaleString("en")} in 7 days`} />
        <StatTile label="Error rate, 24h" value={`${rate(day).toFixed(1)}%`} sub={`${rate(week).toFixed(1)}% over 7 days`} tone={rate(day) > 5 ? "warn" : "neutral"} />
        <StatTile label="Median latency" value={day.p50 === null ? "n/a" : `${Math.round(day.p50)} ms`} sub="Last 24h" />
        <StatTile label="p95 latency" value={day.p95 === null ? "n/a" : `${Math.round(day.p95)} ms`} sub="Last 24h" />
      </div>
      <div className="rounded-xl border border-line bg-surface p-6">
        <UsageChart data={series} title="Requests per day, last 14 days" />
      </div>
      <section aria-labelledby="routes" className="flex flex-col gap-3">
        <h2 id="routes" className="text-lg font-semibold tracking-tight">
          Endpoints, last 7 days
        </h2>
        {routes.length === 0 ? (
          <p className="text-sm text-muted">No requests yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 font-medium">Endpoint</th>
                  <th className="px-4 py-2.5 text-right font-medium">Requests</th>
                  <th className="px-4 py-2.5 text-right font-medium">Errors</th>
                  <th className="px-4 py-2.5 text-right font-medium">p95</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {routes.map((r) => (
                  <tr key={r.route}>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.route}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{r.requests.toLocaleString("en")}</td>
                    <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${r.errors ? "text-amber" : "text-muted"}`}>{r.errors}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted tabular-nums">{Math.round(r.p95)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: number }) {
  const tone = status >= 500 ? "bg-danger/15 text-danger" : status >= 400 ? "bg-amber-soft text-amber" : "bg-verdigris-soft text-verdigris";
  return <span className={`inline-flex rounded px-1.5 py-0.5 font-mono text-xs font-medium ${tone}`}>{status}</span>;
}

async function Logs({ organizationId, projectId, errorsOnly }: { organizationId: string; projectId: string; errorsOnly: boolean }) {
  const rows = await recentRequests({ organizationId, projectId }, errorsOnly ? "errors" : "all", 100);
  const base = `/dashboard/developers/${projectId}?tab=logs`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5" role="group" aria-label="Filter">
          {[
            { href: base, label: "All requests", active: !errorsOnly },
            { href: `${base}&status=errors`, label: "Errors only", active: errorsOnly },
          ].map((f) => (
            <Link
              key={f.label}
              href={f.href}
              scroll={false}
              aria-current={f.active ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-xs ${f.active ? "border-ink bg-ink text-paper" : "border-line text-muted hover:text-ink"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <Link href={errorsOnly ? `${base}&status=errors` : base} className="text-xs text-muted hover:text-ink" prefetch={false}>
          Refresh
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">
          {errorsOnly ? "No failed requests in the last 30 days." : "No requests yet. Calls made with this project's keys appear here within a few seconds."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Request</th>
                <th className="px-4 py-2.5 text-right font-medium">Latency</th>
                <th className="px-4 py-2.5 font-medium">Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-xs whitespace-nowrap text-muted">{timeFmt.format(r.createdAt)}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="max-w-[28rem] px-4 py-2">
                    <span className="flex flex-col">
                      <span className="truncate font-mono text-xs">
                        <span className="text-muted">{r.method}</span> {r.path}
                      </span>
                      {r.errorCode ? <span className="font-mono text-[11px] text-muted">{r.errorCode}</span> : null}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">{r.durationMs} ms</td>
                  <td className="px-4 py-2 text-xs text-muted">{r.keyName ?? r.keyPrefix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function Settings({ projectId, name }: { projectId: string; name: string }) {
  const { can } = await requireOrg();
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <div className="grid gap-5 rounded-xl border border-line bg-surface p-5 sm:grid-cols-2">
        <CopyField label="Project ID" value={projectId} hint="Useful when you contact support." />
        <CopyField label="Base URL" value={API_BASE_URL} hint="All endpoints live under /v1." />
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Archive</h2>
        <div className="flex flex-col gap-3 rounded-xl border border-danger/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {can({ project: ["delete"] }) ? "Revokes every key in this project and hides it. Logs are kept." : "Only admins and owners can archive projects."}
          </p>
          {can({ project: ["delete"] }) ? <ArchiveProjectButton projectId={projectId} name={name} /> : null}
        </div>
      </section>
    </div>
  );
}
