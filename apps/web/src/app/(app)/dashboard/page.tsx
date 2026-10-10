import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui";
import { requireOrg } from "@/lib/dal";

export const metadata: Metadata = { title: "Overview" };

const modules = [
  {
    name: "Explorer",
    does: "Balances, tokens, NFTs and transaction history for any address across Ethereum, Base, Polygon, Arbitrum and Optimism.",
    phase: "Next up",
  },
  {
    name: "API & keys",
    does: "A REST API over the same data, with per-project keys, rate limits and request logs.",
    phase: "Planned",
  },
  {
    name: "Monitors",
    does: "Watch wallets and contracts, then get Telegram messages or signed webhooks when something moves.",
    phase: "Planned",
  },
  {
    name: "Contract studio",
    does: "Start from audited templates, deploy to Sepolia or Base Sepolia from your wallet, and call functions from the browser.",
    phase: "Planned",
  },
];

export default function OverviewPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <Suspense fallback={<p className="h-5 text-sm text-muted" />}>
          <OrgSummary />
        </Suspense>
      </header>

      <section aria-labelledby="modules" className="flex flex-col gap-3">
        <h2 id="modules" className="text-sm font-medium">
          What this workspace will do
        </h2>
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {modules.map((m) => (
            <li key={m.name} className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{m.name}</span>
                <span className="text-sm text-muted">{m.does}</span>
              </div>
              <span className="shrink-0">
                <Badge tone={m.phase === "Next up" ? "pending" : "neutral"}>{m.phase}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Suspense>
        <InviteNudge />
      </Suspense>
    </div>
  );
}

async function OrgSummary() {
  const { org, role } = await requireOrg();
  return (
    <p className="text-sm text-muted">
      {org.name} has {org.members.length} {org.members.length === 1 ? "member" : "members"}. You are{" "}
      {role === "owner" || role === "admin" ? "an" : "a"} {role}.
    </p>
  );
}

async function InviteNudge() {
  const { org, can } = await requireOrg();
  if (org.members.length > 1 || !can({ invitation: ["create"] })) return null;
  return (
    <p className="text-sm text-muted">
      Working with others?{" "}
      <Link href="/dashboard/settings" className="text-ink underline underline-offset-4">
        Invite your team
      </Link>{" "}
      and give each person the access they need.
    </p>
  );
}
