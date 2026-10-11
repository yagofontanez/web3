import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { EventParams, TransferParams } from "@w3s/db/schema";
import { MonitorForm } from "@/components/monitors/monitor-form";
import { requireOrg } from "@/lib/dal";
import { getMonitor } from "@/lib/monitoring";
import { formData } from "../../form-data";

export const metadata: Metadata = { title: "Edit monitor" };

export default function EditMonitorPage({ params }: PageProps<"/dashboard/monitors/[monitorId]/edit">) {
  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Body params={params} />
      </Suspense>
    </div>
  );
}

async function Body({ params }: { params: Promise<{ monitorId: string }> }) {
  const { monitorId } = await params;
  const { org, can } = await requireOrg();
  const m = await getMonitor(org.id, monitorId);
  if (!m) notFound();
  if (!can({ monitor: ["update"] })) return <p className="text-sm text-muted">Your role can&apos;t edit monitors.</p>;
  const data = await formData(org.id);
  const t = m.params as TransferParams;
  return (
    <>
      <Link href={`/dashboard/monitors/${m.id}`} className="w-fit text-sm text-muted hover:text-ink">
        {m.name}
      </Link>
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">Edit monitor</h1>
      <MonitorForm
        {...data}
        monitorId={m.id}
        initial={{
          kind: m.kind,
          name: m.name,
          network: m.network,
          address: m.address,
          channelIds: m.channelIds,
          ...(m.kind === "transfer"
            ? {
                direction: t.direction,
                assetMode: t.asset === "any" || t.asset === "native" ? t.asset : "token",
                token: t.asset === "any" || t.asset === "native" ? "" : t.asset,
                minAmount: t.minAmount ?? "",
              }
            : { signature: (m.params as EventParams).signature }),
        }}
      />
    </>
  );
}
