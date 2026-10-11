import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/developers/code-block";
import { endpoints, errors } from "@/lib/api-docs";

export const metadata: Metadata = { title: "API reference" };

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100").replace(/\/$/, "");

export default function DocsPage() {
  return (
    <div className="grid max-w-6xl gap-12 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <nav aria-label="On this page" className="hidden lg:block">
        <ul className="sticky top-10 flex flex-col gap-1 text-sm">
          {[
            { id: "auth", label: "Authentication" },
            { id: "limits", label: "Rate limits" },
            { id: "errors", label: "Errors" },
          ].map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block rounded px-2 py-1 text-muted hover:text-ink">
                {s.label}
              </a>
            </li>
          ))}
          <li className="mt-3 px-2 text-xs text-muted">Endpoints</li>
          {endpoints.map((e) => (
            <li key={e.id}>
              <a href={`#${e.id}`} className="block truncate rounded px-2 py-1 font-mono text-xs text-muted hover:text-ink">
                {e.path.replace("/v1", "")}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-col gap-14">
        <header className="flex flex-col gap-3">
          <Link href="/dashboard/developers" className="w-fit text-sm text-muted hover:text-ink">
            API &amp; keys
          </Link>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">API reference</h1>
          <p className="max-w-[64ch] text-muted">
            A read-only REST API over the same data as the explorer. Every response is JSON with a <span className="font-mono text-ink">data</span>{" "}
            field, and list endpoints add <span className="font-mono text-ink">meta</span> with pagination.
          </p>
          <CodeBlock label="Base URL" code={BASE} />
        </header>

        <section id="auth" className="flex scroll-mt-10 flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Authentication</h2>
          <p className="max-w-[64ch] text-muted">
            Create a key inside a project, then send it as a Bearer token. The <span className="font-mono text-ink">x-api-key</span> header works too.
            Keys start with <span className="font-mono text-ink">w3s_live_</span> and are shown once, so store them in your secret manager.
          </p>
          <CodeBlock code={`curl ${BASE}/v1/networks \\\n  -H "Authorization: Bearer $SYSTEMA_API_KEY"`} />
        </section>

        <section id="limits" className="flex scroll-mt-10 flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Rate limits</h2>
          <p className="max-w-[64ch] text-muted">
            Each key has its own per-minute limit, picked when you create it. Responses carry{" "}
            <span className="font-mono text-ink">x-ratelimit-limit</span>, <span className="font-mono text-ink">x-ratelimit-remaining</span> and{" "}
            <span className="font-mono text-ink">x-ratelimit-reset</span>. Over the limit you get a 429 with <span className="font-mono text-ink">retry-after</span>.
          </p>
        </section>

        <section id="errors" className="flex scroll-mt-10 flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Errors</h2>
          <CodeBlock code={`{ "error": { "code": "rate_limited", "message": "This key is limited to 120 requests per minute. Retry in 14s." } }`} />
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-line">
                {errors.map((e) => (
                  <tr key={e.code}>
                    <td className="px-4 py-2.5 font-mono text-xs">{e.status}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{e.code}</td>
                    <td className="px-4 py-2.5 text-muted">{e.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {endpoints.map((e) => (
          <section key={e.id} id={e.id} className="flex scroll-mt-10 flex-col gap-4 border-t border-line pt-10">
            <div className="flex flex-col gap-2">
              <h2 className="flex flex-wrap items-center gap-2 font-mono text-base">
                <span className="rounded bg-verdigris-soft px-1.5 py-0.5 text-xs font-semibold text-verdigris">{e.method}</span>
                {e.path}
              </h2>
              <p className="text-muted">{e.summary}</p>
            </div>
            {e.params.length > 0 ? (
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
                {e.params.map((p) => (
                  <div key={p.name} className="contents">
                    <dt className="font-mono text-xs">
                      {p.name}
                      <span className="ml-2 text-muted">
                        {p.in}
                        {p.required ? ", required" : ""}
                      </span>
                    </dt>
                    <dd className="text-muted">{p.description}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <div className="flex flex-col gap-3">
              <CodeBlock label="Request" code={`curl "${BASE}${e.example}" \\\n  -H "Authorization: Bearer $SYSTEMA_API_KEY"`} />
              <CodeBlock label="Response" code={e.response} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
