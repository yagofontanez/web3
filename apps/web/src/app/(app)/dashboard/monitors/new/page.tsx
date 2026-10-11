import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MonitorForm } from "@/components/monitors/monitor-form";
import { requireOrg } from "@/lib/dal";
import { formData } from "../form-data";

export const metadata: Metadata = { title: "New monitor" };

export default function NewMonitorPage() {
  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <Link href="/dashboard/monitors" className="w-fit text-sm text-muted hover:text-ink">
        Monitors
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">New monitor</h1>
        <p className="text-muted">Pick what to watch, when to alert and where to send it. The preview updates as you go.</p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  const { org, can } = await requireOrg();
  if (!can({ monitor: ["create"] })) return <p className="text-sm text-muted">Your role can&apos;t create monitors.</p>;
  const data = await formData(org.id);
  return <MonitorForm {...data} />;
}
