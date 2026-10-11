import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/developers/code-block";
import { CodeTabs } from "@/components/developers/code-tabs";
import { DocNav } from "@/components/developers/doc-nav";
import { endpoints, errors } from "@/lib/api-docs";
import { snippets } from "@/lib/snippets";

export const metadata: Metadata = { title: "API reference" };

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100").replace(/\/$/, "");

const sections = [
  { id: "auth", label: "Authentication", group: "Guides" },
  { id: "limits", label: "Rate limits", group: "Guides" },
  { id: "errors", label: "Errors", group: "Guides" },
  { id: "pagination", label: "Pagination", group: "Guides" },
  ...endpoints.map((e) => ({ id: e.id, label: e.path.replace("/v1", ""), mono: true, group: "Endpoints" })),
];

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-surface px-1 py-0.5 font-mono text-[0.88em] text-ink ring-1 ring-line">{children}</code>;
}

export default function DocsPage() {
  return (
    <div className="grid max-w-6xl gap-12 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <div>
        <DocNav sections={sections} />
      </div>

      <div className="flex min-w-0 flex-col gap-14">
        <header className="flex flex-col gap-4">
          <Link href="/dashboard/developers" className="w-fit text-sm text-muted hover:text-ink">
            API &amp; keys
          </Link>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">API reference</h1>
          <p className="max-w-[64ch] text-muted">
            A read-only REST API over the same data as the explorer. Responses are JSON with a <Mono>data</Mono> field; list endpoints add{" "}
            <Mono>meta</Mono> with context and pagination. Every address parameter also accepts an ENS name.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Base URL", BASE],
              ["Auth", "Bearer w3s_live_…"],
              ["Format", "JSON over HTTPS"],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 rounded-lg border border-line bg-surface px-4 py-3">
                <span className="text-xs text-muted">{k}</span>
                <span className="truncate font-mono text-sm">{v}</span>
              </div>
            ))}
          </div>
        </header>

        <section id="auth" className="flex scroll-mt-10 flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Authentication</h2>
          <p className="max-w-[64ch] text-muted">
            Create a key inside a project, then send it as a Bearer token. <Mono>x-api-key</Mono> works too. Keys start with <Mono>w3s_live_</Mono> and are
            shown once, so keep them in a secret manager and never ship them to a browser.
          </p>
          <CodeTabs code={snippets(BASE, "/v1/networks")} />
        </section>

        <section id="limits" className="flex scroll-mt-10 flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Rate limits</h2>
          <p className="max-w-[64ch] text-muted">
            Each key has one per-minute budget shared by every endpoint, picked when you create it. Every response carries <Mono>x-ratelimit-limit</Mono>,{" "}
            <Mono>x-ratelimit-remaining</Mono> and <Mono>x-ratelimit-reset</Mono>. Over budget you get a 429 with <Mono>retry-after</Mono> in seconds.
          </p>
        </section>

        <section id="errors" className="flex scroll-mt-10 flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Errors</h2>
          <p className="max-w-[64ch] text-muted">Failures always have the same shape, and the message says how to fix the request.</p>
          <CodeBlock code={`{\n  "error": {\n    "code": "rate_limited",\n    "message": "This key is limited to 120 requests per minute. Retry in 14s."\n  }\n}`} />
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-line">
                {errors.map((e) => (
                  <tr key={e.code}>
                    <td className="w-16 px-4 py-2.5 font-mono text-xs">{e.status}</td>
                    <td className="w-40 px-4 py-2.5 font-mono text-xs">{e.code}</td>
                    <td className="px-4 py-2.5 text-muted">{e.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="pagination" className="flex scroll-mt-10 flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Pagination</h2>
          <p className="max-w-[64ch] text-muted">
            NFTs and activity return <Mono>meta.nextCursor</Mono>. Pass it back as <Mono>?cursor=</Mono> to get the next page. When it&apos;s{" "}
            <Mono>null</Mono>, you&apos;ve reached the end.
          </p>
        </section>

        {endpoints.map((e) => (
          <section key={e.id} id={e.id} className="grid scroll-mt-10 gap-6 border-t border-line pt-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="flex flex-wrap items-center gap-2 font-mono text-[15px]">
                  <span className="rounded bg-verdigris-soft px-1.5 py-0.5 text-xs font-semibold text-verdigris">{e.method}</span>
                  <span className="break-all">{e.path}</span>
                </h2>
                <p className="text-muted">{e.summary}</p>
              </div>
              {e.params.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-xs text-muted">Parameters</h3>
                  <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                    {e.params.map((p) => (
                      <li key={p.name} className="flex flex-col gap-1 px-3.5 py-2.5">
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span className="font-mono text-sm">{p.name}</span>
                          <span className="text-xs text-muted">{p.in}</span>
                          {p.required ? <span className="text-xs text-amber">required</span> : null}
                        </span>
                        <span className="text-sm text-muted">{p.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <CodeTabs label="Request" code={snippets(BASE, e.example)} />
              <CodeBlock label="Response" code={e.response} wrap />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
