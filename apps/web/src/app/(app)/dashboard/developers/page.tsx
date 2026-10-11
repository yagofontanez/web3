import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CodeBlock } from "@/components/developers/code-block";
import { NewProjectButton } from "@/components/developers/project-forms";
import { StatTile, UsageChart } from "@/components/developers/usage-chart";
import { requireOrg } from "@/lib/dal";
import { API_BASE_URL, dailyUsage, listProjects, usageSummary } from "@/lib/developer";
import { sinceNow } from "@/lib/format";

export const metadata: Metadata = { title: "API & keys" };

export default function DevelopersPage() {
  return (
    <div className="flex max-w-6xl flex-col gap-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">API &amp; keys</h1>
          <p className="max-w-[62ch] text-muted">
            Serve the explorer&apos;s balances, NFTs, activity and ENS lookups to your own apps. Each project gets its own keys, limits and
            request log.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/dashboard/developers/docs" className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium hover:border-muted">
            Read the docs
          </Link>
          <Suspense>
            <CreateIfAllowed />
          </Suspense>
        </div>
      </header>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl border border-line bg-surface" />}>
        <OrgUsage />
      </Suspense>

      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl border border-line bg-surface" />}>
        <Projects />
      </Suspense>
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
  const [day, series] = await Promise.all([usageSummary(scope, 1), dailyUsage(scope, 14)]);
  const errorRate = day.requests ? (day.errors / day.requests) * 100 : 0;
  return (
    <section aria-label="Usage" className="grid gap-8 rounded-xl border border-line bg-surface p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
      <div className="grid grid-cols-2 gap-6 self-start">
        <StatTile label="Requests, 24h" value={day.requests.toLocaleString("en")} />
        <StatTile label="Error rate" value={`${errorRate.toFixed(1)}%`} sub={`${day.errors} of ${day.requests}`} tone={errorRate > 5 ? "warn" : "neutral"} />
        <StatTile label="Median latency" value={day.p50 === null ? "n/a" : `${Math.round(day.p50)} ms`} />
        <StatTile label="p95 latency" value={day.p95 === null ? "n/a" : `${Math.round(day.p95)} ms`} />
      </div>
      <UsageChart data={series} title="Requests per day, last 14 days" />
    </section>
  );
}

async function Projects() {
  const { org, can } = await requireOrg();
  const projects = await listProjects(org.id);

  if (projects.length === 0) {
    return (
      <section className="grid gap-8 rounded-xl border border-dashed border-line p-6 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Make your first call in a minute</h2>
          <ol className="flex flex-col gap-2 text-sm text-muted">
            <li>1. Create a project for the app that will call the API.</li>
            <li>2. Create a key inside it and copy it. It&apos;s shown only once.</li>
            <li>3. Send it as a Bearer token. Every request shows up in the project&apos;s log.</li>
          </ol>
          {can({ project: ["create"] }) ? (
            <div>
              <NewProjectButton />
            </div>
          ) : (
            <p className="text-sm text-muted">Ask an admin or developer to create a project.</p>
          )}
        </div>
        <CodeBlock label="Your first request" code={`curl ${API_BASE_URL}/v1/addresses/vitalik.eth/portfolio \\\n  -H "Authorization: Bearer w3s_live_…"`} />
      </section>
    );
  }

  return (
    <section aria-labelledby="projects" className="flex flex-col gap-4">
      <h2 id="projects" className="text-lg font-semibold tracking-tight">
        Projects
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {projects.map((p) => (
          <li key={p.id}>
            <Link href={`/dashboard/developers/${p.id}`} className="flex h-full flex-col gap-4 rounded-xl border border-line bg-surface p-5 hover:border-muted">
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{p.name}</span>
                <span className="line-clamp-1 text-sm text-muted">{p.description || "No description"}</span>
              </div>
              <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Active keys</dt>
                  <dd className="font-mono tabular-nums">{p.activeKeys}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Requests, 7d</dt>
                  <dd className="font-mono tabular-nums">{p.requests7d.toLocaleString("en")}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">Last call</dt>
                  <dd>{p.lastRequestAt ? sinceNow(new Date(p.lastRequestAt)) : "never"}</dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
