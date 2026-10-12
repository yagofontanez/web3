import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContractBuilder } from "@/components/contracts/builder";
import { requireOrg } from "@/lib/dal";

export const metadata: Metadata = { title: "New contract" };

export default function NewContractPage({ searchParams }: PageProps<"/dashboard/contracts/new">) {
  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <Link href="/dashboard/contracts" className="w-fit text-sm text-muted hover:text-ink">
        Contract studio
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">New contract</h1>
        <p className="text-muted">Pick a starting point and adjust it. The source on the right is exactly what gets compiled.</p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Builder searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Builder({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { can } = await requireOrg();
  if (!can({ contract: ["create"] })) return <p className="text-sm text-muted">Your role can&apos;t create contracts.</p>;
  const type = (await searchParams).type;
  const initial = type === "erc721" || type === "custom" ? type : "erc20";
  return <ContractBuilder initial={initial} />;
}
