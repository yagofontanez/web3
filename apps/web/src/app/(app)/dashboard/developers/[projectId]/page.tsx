import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CodeTabs } from "@/components/developers/code-tabs";
import { LiveToggle, LogTable } from "@/components/developers/live-logs";
import { ArchiveProjectButton, NewKeyButton, RevokeKeyButton } from "@/components/developers/project-forms";
import { ProjectDetailsForm } from "@/components/developers/project-settings";
import { StatTile, UsageChart } from "@/components/developers/usage-chart";
import { SectionTabs } from "@/components/section-tabs";
import { CopyField } from "@/components/settings/general";
import { requireOrg } from "@/lib/dal";
import {
  API_BASE_URL,
  dailyUsage,
  getProject,
  listKeys,
  recentRequests,
  statusBreakdown,
  topErrors,
  topRoutes,
  usageSummary,
  type LogFilter,
} from "@/lib/developer";
import { sinceNow } from "@/lib/format";
import { snippets } from "@/lib/snippets";

export const metadata: Metadata = { title: "Project" };

type Props = PageProps<"/dashboard/developers/[projectId]">;

export default function ProjectPage({ params, searchParams }: Props) {
  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <Link href="/dashboard/developers" className="w-fit text-sm text-muted hover:text-ink">
        API &amp; keys
      </Link>
      <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-line/30" />}>
        <Body params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ params, searchParams }: Props) {
  const [{ projectId }, sp, { org, can }] = await Promise.all([params, searchParams, requireOrg()]);
  const project = await getProject(org.id, projectId);
  if (!project) notFound();
  const tab = typeof sp.tab === "string" ? sp.tab : "keys";
  const filter = (["2xx", "4xx", "5xx"].includes(String(sp.status)) ? sp.status : "all") as LogFilter;
  const scope = { organizationId: org.id, projectId: project.id };
  const day = await usageSummary(scope, 1);
  const keys = await listKeys(project.id);
  const activeKeys = keys.filter((k) => !k.revokedAt).length;

  return (
    <>
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="truncate text-3xl font-semibold tracking-[-0.02em]">{project.name}</h1>
          <p className="text-sm text-muted">
            {project.description ? `${project.description}. ` : ""}Created {sinceNow(project.createdAt)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <dl className="flex gap-8 text-sm">
            {[
              ["Active keys", String(activeKeys)],
              ["Requests, 24h", day.requests.toLocaleString("en")],
              ["Errors, 24h", day.errors.toLocaleString("en")],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-mono text-lg tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {can({ apiKey: ["create"] }) ? <NewKeyButton projectId={project.id} baseUrl={API_BASE_URL} /> : null}
        </div>
      </header>
      <SectionTabs
        label="Project sections"
        fallback="keys"
        tabs={[
          { id: "keys", label: "Keys", count: activeKeys },
          { id: "usage", label: "Usage" },
          { id: "logs", label: "Logs" },
          { id: "settings", label: "Settings" },
        ]}
      />
      <Suspense key={tab + filter} fallback={<p className="text-sm text-muted">Loading…</p>}>
        {tab === "usage" ? (
          <Usage organizationId={org.id} projectId={project.id} />
        ) : tab === "logs" ? (
          <Logs organizationId={org.id} projectId={project.id} filter={filter} />
        ) : tab === "settings" ? (
          <Settings projectId={project.id} name={project.name} description={project.description} />
        ) : (
          <Keys keys={keys} canRevoke={can({ apiKey: ["revoke"] })} />
        )}
      </Suspense>
    </>
  );
}

type KeyRow = Awaited<ReturnType<typeof listKeys>>[number];

function Keys({ keys, canRevoke }: { keys: KeyRow[]; canRevoke: boolean }) {
  const active = keys.filter((k) => !k.revokedAt);
  const revoked = keys.filter((k) => k.revokedAt);

  if (keys.length === 0) {
    return (
      <div className="grid gap-6 rounded-xl border border-dashed border-line p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center">
        <div className="flex flex-col gap-2">
          <p className="font-medium">No keys yet</p>
          <p className="text-sm text-muted">
            Create one with the button above, copy it into your secret manager, then run the request. It&apos;ll show up under Logs within seconds.
          </p>
        </div>
        <CodeTabs code={snippets(API_BASE_URL, "/v1/networks")} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">Every key in this project is revoked. Create a new one to start calling the API again.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {active.map((k) => (
            <li key={k.id} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2 font-semibold">
                    <span aria-hidden className="size-2 rounded-full bg-verdigris" />
                    <span className="truncate">{k.name}</span>
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {k.prefix}
                    <span aria-hidden>••••••••••••••••••••••••••</span>
                    <span className="sr-only">rest of the key hidden</span>
                  </span>
                </div>
                {canRevoke ? <RevokeKeyButton keyId={k.id} name={k.name} /> : null}
              </div>
              <dl className="grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Requests, 24h</dt>
                  <dd className="font-mono tabular-nums">{k.requests24h.toLocaleString("en")}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Limit</dt>
                  <dd className="font-mono tabular-nums">{k.rateLimitPerMinute}/min</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Last used</dt>
                  <dd>{k.lastUsedAt ? sinceNow(k.lastUsedAt) : <span className="text-muted">never</span>}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted">
                Created {sinceNow(k.createdAt)}
                {k.createdBy ? ` by ${k.createdBy}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      {revoked.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-sm text-muted hover:text-ink">
            <span className="mr-1.5 inline-block transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
            {revoked.length === 1 ? "1 revoked key" : `${revoked.length} revoked keys`}
          </summary>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
            {revoked.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm text-muted">
                <span className="flex items-center gap-2">
                  <span className="line-through decoration-line">{k.name}</span>
                  <span className="font-mono text-xs">{k.prefix}…</span>
                </span>
                <span className="text-xs">
                  Revoked {sinceNow(k.revokedAt!)}, last used {k.lastUsedAt ? sinceNow(k.lastUsedAt) : "never"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

async function Usage({ organizationId, projectId }: { organizationId: string; projectId: string }) {
  const scope = { organizationId, projectId };
  const [day, week, series, routes, statuses, errors] = await Promise.all([
    usageSummary(scope, 1),
    usageSummary(scope, 7),
    dailyUsage(scope, 14),
    topRoutes(scope, 7),
    statusBreakdown(scope, 7),
    topErrors(scope, 7),
  ]);
  const rate = (s: { requests: number; errors: number }) => (s.requests ? (s.errors / s.requests) * 100 : 0);
  const totalStatus = statuses.ok + statuses.client + statuses.server;
  const segments = [
    { label: "Succeeded", sub: "2xx", value: statuses.ok, color: "bg-verdigris" },
    { label: "Client errors", sub: "4xx", value: statuses.client, color: "bg-amber" },
    { label: "Server errors", sub: "5xx", value: statuses.server, color: "bg-danger" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-6 rounded-xl border border-line bg-surface p-6 md:grid-cols-4">
        <StatTile label="Requests, 24h" value={day.requests.toLocaleString("en")} sub={`${week.requests.toLocaleString("en")} in 7 days`} />
        <StatTile label="Error rate, 24h" value={`${rate(day).toFixed(1)}%`} sub={`${rate(week).toFixed(1)}% over 7 days`} tone={rate(day) > 5 ? "warn" : "neutral"} />
        <StatTile label="Median latency" value={day.p50 === null ? "n/a" : `${Math.round(day.p50)} ms`} sub="Last 24h" />
        <StatTile label="p95 latency" value={day.p95 === null ? "n/a" : `${Math.round(day.p95)} ms`} sub="Last 24h" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-line bg-surface p-6">
          <UsageChart data={series} title="Requests per day, last 14 days" />
        </div>
        <section aria-labelledby="outcomes" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
          <h2 id="outcomes" className="font-semibold">
            Outcomes, last 7 days
          </h2>
          {totalStatus === 0 ? (
            <p className="text-sm text-muted">No requests yet.</p>
          ) : (
            <>
              <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Share of requests by outcome">
                {segments
                  .filter((s) => s.value > 0)
                  .map((s) => (
                    <span key={s.sub} className={`${s.color} first:rounded-l-full last:rounded-r-full`} style={{ width: `${(s.value / totalStatus) * 100}%` }} />
                  ))}
              </div>
              <ul className="flex flex-col gap-2.5 text-sm">
                {segments.map((s) => (
                  <li key={s.sub} className="flex items-center gap-2.5">
                    <span aria-hidden className={`size-2.5 rounded-sm ${s.color}`} />
                    <span className="flex-1">
                      {s.label} <span className="font-mono text-xs text-muted">{s.sub}</span>
                    </span>
                    <span className="font-mono tabular-nums">{s.value.toLocaleString("en")}</span>
                    <span className="w-12 text-right font-mono text-xs text-muted tabular-nums">{((s.value / totalStatus) * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
              {errors.length > 0 ? (
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                  <h3 className="text-xs text-muted">Most common errors</h3>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {errors.map((e) => (
                      <li key={`${e.code}-${e.status}`} className="flex items-center justify-between gap-3">
                        <span className="truncate font-mono text-xs">
                          {e.status} {e.code ?? "unknown"}
                        </span>
                        <span className="font-mono text-xs text-muted tabular-nums">{e.requests}×</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="routes" className="flex flex-col gap-3">
        <h2 id="routes" className="text-lg font-semibold tracking-tight">
          Endpoints, last 7 days
        </h2>
        {routes.length === 0 ? (
          <p className="text-sm text-muted">No requests yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 font-medium">Endpoint</th>
                  <th className="px-4 py-2.5 font-medium">Share</th>
                  <th className="px-4 py-2.5 text-right font-medium">Requests</th>
                  <th className="px-4 py-2.5 text-right font-medium">Errors</th>
                  <th className="px-4 py-2.5 text-right font-medium">p95</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {routes.map((r) => (
                  <tr key={r.route}>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.route}</td>
                    <td className="px-4 py-2.5">
                      <span className="block h-1.5 w-32 overflow-hidden rounded-full bg-paper" title={`${((r.requests / week.requests) * 100).toFixed(1)}% of requests`}>
                        <span className="block h-full rounded-full bg-verdigris" style={{ width: `${Math.max(3, (r.requests / week.requests) * 100)}%` }} />
                      </span>
                    </td>
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

async function Logs({ organizationId, projectId, filter }: { organizationId: string; projectId: string; filter: LogFilter }) {
  const rows = await recentRequests({ organizationId, projectId }, filter, 100);
  const base = `/dashboard/developers/${projectId}?tab=logs`;
  const filters: { id: LogFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "2xx", label: "2xx" },
    { id: "4xx", label: "4xx" },
    { id: "5xx", label: "5xx" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5" role="group" aria-label="Filter by status">
          {filters.map((f) => (
            <Link
              key={f.id}
              href={f.id === "all" ? base : `${base}&status=${f.id}`}
              scroll={false}
              aria-current={filter === f.id ? "true" : undefined}
              className={`rounded-full border px-3 py-1 font-mono text-xs ${filter === f.id ? "border-ink bg-ink text-paper" : "border-line text-muted hover:text-ink"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <LiveToggle />
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">
          {filter === "all" ? "No requests yet. Calls made with this project's keys appear here within a few seconds." : `No ${filter} responses in the last 30 days.`}
        </p>
      ) : (
        <>
          <LogTable rows={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))} />
          <p className="text-xs text-muted">Showing the latest {rows.length} requests from the last 30 days. Click a row for details.</p>
        </>
      )}
    </div>
  );
}

async function Settings({ projectId, name, description }: { projectId: string; name: string; description: string | null }) {
  const { can } = await requireOrg();
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Details</h2>
        <div className="rounded-xl border border-line bg-surface p-5">
          <ProjectDetailsForm projectId={projectId} name={name} description={description} editable={can({ project: ["update"] })} />
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Connection</h2>
        <div className="grid gap-5 rounded-xl border border-line bg-surface p-5 sm:grid-cols-2">
          <CopyField label="Base URL" value={API_BASE_URL} hint="Every endpoint lives under /v1." />
          <CopyField label="Project ID" value={projectId} hint="Useful when you contact support." />
        </div>
      </section>
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
