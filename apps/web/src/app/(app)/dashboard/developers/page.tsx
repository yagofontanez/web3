import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ApiStatus } from "@/components/developers/api-status";
import { CodeTabs } from "@/components/developers/code-tabs";
import { NewProjectButton } from "@/components/developers/project-forms";
import { Sparkline } from "@/components/developers/sparkline";
import { StatTile, UsageChart } from "@/components/developers/usage-chart";
import { requireOrg } from "@/lib/dal";
import { API_BASE_URL, dailyUsage, listProjects, usageSummary } from "@/lib/developer";
import { sinceNow } from "@/lib/format";
import { snippets } from "@/lib/snippets";

export const metadata: Metadata = { title: "API & keys" };

export default function DevelopersPage() {
  return (
    <div className="flex max-w-6xl flex-col gap-10">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3">
          <Suspense fallback={<span className="h-7 w-64 animate-pulse rounded-full bg-line/50" />}>
            <ApiStatus />
          </Suspense>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">API &amp; keys</h1>
          <p className="max-w-[62ch] text-muted">
            Serve balances, NFTs, activity and ENS lookups to your own apps. Each project gets its own keys, limits and request log.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/dashboard/developers/docs" className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium hover:border-muted">
            API reference
          </Link>
          <Suspense>
            <CreateIfAllowed />
          </Suspense>
        </div>
      </header>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl border border-line bg-surface" />}>
        <OrgUsage />
      </Suspense>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Suspense fallback={<div className="h-48 animate-pulse rounded-xl border border-line bg-surface" />}>
          <Projects />
        </Suspense>
        <section aria-labelledby="quickstart" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="quickstart" className="text-lg font-semibold tracking-tight">
              Quickstart
            </h2>
            <p className="text-sm text-muted">Put a key in SYSTEMA_API_KEY and run this from any backend.</p>
          </div>
          <CodeTabs code={snippets(API_BASE_URL, "/v1/addresses/vitalik.eth/portfolio")} />
          <ul className="flex flex-col gap-2 text-sm">
            {[
              ["Every response is JSON with a data field", "#"],
              ["Each key has one per-minute limit across all endpoints", "#limits"],
              ["Errors always look like { error: { code, message } }", "#errors"],
            ].map(([text, hash]) => (
              <li key={text} className="flex gap-2.5">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-verdigris" />
                <Link href={`/dashboard/developers/docs${hash === "#" ? "" : hash}`} className="text-muted hover:text-ink">
                  {text}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

async function CreateIfAllowed() {
  const { can } = await requireOrg();
  return can({ project: ["create"] }) ? <NewProjectButton /> : null;
}

async function OrgUsage() {
  const { org } = await requireOrg();
  const scope = { organizationId: org.id };
  const [day, week, series] = await Promise.all([usageSummary(scope, 1), usageSummary(scope, 7), dailyUsage(scope, 14)]);
  const errorRate = day.requests ? (day.errors / day.requests) * 100 : 0;
  return (
    <section aria-label="Usage across projects" className="grid gap-8 rounded-xl border border-line bg-surface p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
      <div className="grid grid-cols-2 gap-x-6 gap-y-7 self-start">
        <StatTile label="Requests, 24h" value={day.requests.toLocaleString("en")} sub={`${week.requests.toLocaleString("en")} in 7 days`} />
        <StatTile label="Error rate, 24h" value={`${errorRate.toFixed(1)}%`} sub={`${day.errors} failed`} tone={errorRate > 5 ? "warn" : "neutral"} />
        <StatTile label="Median latency" value={day.p50 === null ? "n/a" : `${Math.round(day.p50)} ms`} sub="Last 24h" />
        <StatTile label="p95 latency" value={day.p95 === null ? "n/a" : `${Math.round(day.p95)} ms`} sub="Last 24h" />
      </div>
      <UsageChart data={series} title="Requests per day across all projects" />
    </section>
  );
}

async function Projects() {
  const { org, can } = await requireOrg();
  const projects = await listProjects(org.id);

  return (
    <section aria-labelledby="projects" className="flex min-w-0 flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="projects" className="text-lg font-semibold tracking-tight">
          Projects
        </h2>
        {projects.length > 0 ? <span className="text-sm text-muted">{projects.length === 1 ? "1 project" : `${projects.length} projects`}</span> : null}
      </div>
      {projects.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-line p-6">
          <div className="flex flex-col gap-1">
            <p className="font-medium">Make your first call in a minute</p>
            <ol className="flex flex-col gap-1 text-sm text-muted">
              <li>1. Create a project for the app that will call the API.</li>
              <li>2. Create a key inside it and copy it. It&apos;s shown only once.</li>
              <li>3. Run the quickstart. The request shows up in the project&apos;s logs.</li>
            </ol>
          </div>
          {can({ project: ["create"] }) ? <NewProjectButton /> : <p className="text-sm text-muted">Ask an admin or developer to create a project.</p>}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => {
            const rate = p.requests7d ? (p.errors7d / p.requests7d) * 100 : 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/dashboard/developers/${p.id}`}
                  className="group grid gap-4 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-muted sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-center gap-2 font-semibold">
                      <span aria-hidden className={`size-2 rounded-full ${p.activeKeys > 0 ? "bg-verdigris" : "bg-muted/40"}`} />
                      <span className="truncate group-hover:underline">{p.name}</span>
                    </span>
                    <span className="truncate text-sm text-muted">{p.description || "No description"}</span>
                    <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span>{p.activeKeys === 1 ? "1 active key" : `${p.activeKeys} active keys`}</span>
                      <span>{p.requests7d.toLocaleString("en")} requests in 7 days</span>
                      {p.requests7d > 0 ? <span className={rate > 5 ? "text-amber" : ""}>{rate.toFixed(1)}% errors</span> : null}
                      <span>{p.lastRequestAt ? `last call ${sinceNow(new Date(p.lastRequestAt))}` : "never called"}</span>
                    </span>
                  </div>
                  <Sparkline data={p.series} label={`${p.name}, requests per day`} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
