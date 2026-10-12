import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ImportForm } from "@/components/contracts/import-form";
import { requireOrg } from "@/lib/dal";
import { STUDIO_NETWORKS, studioNetwork } from "@/lib/studio";

export const metadata: Metadata = { title: "Import contract" };

export default function ImportPage() {
  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <Link href="/dashboard/contracts" className="w-fit text-sm text-muted hover:text-ink">
        Contract studio
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">Import a contract</h1>
        <p className="max-w-[62ch] text-muted">
          Any contract with verified source on the block explorer. Proxies are followed to their implementation, so you call the real functions through the proxy address.
        </p>
      </header>
      <Suspense>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  const { can } = await requireOrg();
  if (!can({ contract: ["create"] })) return <p className="text-sm text-muted">Your role can&apos;t import contracts.</p>;
  return <ImportForm networks={STUDIO_NETWORKS.map((s) => ({ slug: s, name: studioNetwork(s)!.name }))} />;
}
