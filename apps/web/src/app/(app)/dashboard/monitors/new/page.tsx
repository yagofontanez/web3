import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MonitorForm } from "@/components/monitors/monitor-form";
import { requireOrg } from "@/lib/dal";
import { templateById } from "@/lib/monitor-templates";
import { formData } from "../form-data";

export const metadata: Metadata = { title: "New monitor" };

export default function NewMonitorPage({ searchParams }: PageProps<"/dashboard/monitors/new">) {
  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <Link href="/dashboard/monitors" className="w-fit text-sm text-muted hover:text-ink">
        Monitors
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Form searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const template = templateById(typeof sp.template === "string" ? sp.template : null);
  const { org, can } = await requireOrg();
  if (!can({ monitor: ["create"] })) return <p className="text-sm text-muted">Your role can&apos;t create monitors.</p>;
  const data = await formData(org.id);
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{template ? template.title : "New monitor"}</h1>
        <p className="text-muted">{template ? `${template.description} Fill in the address and you're set.` : "Pick what to watch, when to alert and where to send it. The preview updates as you go."}</p>
      </header>
      <MonitorForm {...data} initial={template?.values} />
    </>
  );
}
