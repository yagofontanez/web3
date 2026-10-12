import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { and, eq } from "drizzle-orm";
import { createPublicClient, http, type Abi } from "viem";
import { hardhat } from "viem/chains";
import { db, schema } from "@w3s/db";
import { constructorOf, formatValue, functionsOf } from "@w3s/contracts/abi";
import { getChain, rpcUrl } from "@w3s/chains";
import { CodeBlock } from "@/components/developers/code-block";
import { DeployPanel } from "@/components/contracts/deploy-panel";
import { InteractPanel } from "@/components/contracts/interact-panel";
import { RemoveContract, VerifyButton } from "@/components/contracts/manage";
import { SolidityCode } from "@/components/contracts/solidity-code";
import { AddressGlyph } from "@/components/explorer/address-glyph";
import { NetworkChip } from "@/components/monitors/visuals";
import { SectionTabs } from "@/components/section-tabs";
import { CopyField } from "@/components/settings/general";
import { requireOrg } from "@/lib/dal";
import { sinceNow } from "@/lib/format";
import { FAUCETS, LOCAL_CHAIN_ID, STUDIO_NETWORKS, studioNetwork } from "@/lib/studio";

export const metadata: Metadata = { title: "Contract" };

type Props = PageProps<"/dashboard/contracts/[contractId]">;

export default function ContractPage({ params, searchParams }: Props) {
  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <Link href="/dashboard/contracts" className="w-fit text-sm text-muted hover:text-ink">
        Contract studio
      </Link>
      <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-line/30" />}>
        <Body params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function initialReads(abi: unknown[], chainId: number, address: string) {
  const chain = chainId === LOCAL_CHAIN_ID ? hardhat : getChain(chainId);
  if (!chain) return {};
  const client = createPublicClient({ chain, transport: http(chainId === LOCAL_CHAIN_ID ? process.env.STUDIO_LOCAL_RPC : rpcUrl(chainId)) });
  const reads = functionsOf(abi).reads.filter((f) => f.inputs.length === 0).slice(0, 14);
  const results = await Promise.all(
    reads.map(async (f) => {
      try {
        const v = await client.readContract({ address: address as `0x${string}`, abi: [f] as Abi, functionName: f.name });
        return [`${f.name}()`, formatValue(v)] as [string, string];
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(results.filter((r): r is [string, string] => r !== null));
}

async function Body({ params, searchParams }: Props) {
  const [{ contractId }, sp, { org, can }] = await Promise.all([params, searchParams, requireOrg()]);
  const [c] = await db.select().from(schema.studioContract).where(and(eq(schema.studioContract.id, contractId), eq(schema.studioContract.organizationId, org.id))).limit(1);
  if (!c) notFound();
  const deployed = c.status === "deployed" && !!c.address && !!c.chainId;
  const net = studioNetwork(c.network);
  const fallbackTab = deployed ? "interact" : "deploy";
  const tab = typeof sp.tab === "string" ? sp.tab : fallbackTab;
  const fns = functionsOf(c.abi);
  const tabs = [
    ...(deployed ? [{ id: "interact", label: "Interact" }] : []),
    ...(!deployed && c.bytecode ? [{ id: "deploy", label: "Deploy" }] : []),
    { id: "code", label: c.source ? "Code" : "ABI" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <>
      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {c.address ? (
            <AddressGlyph address={c.address} className="size-16" />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-md border border-dashed border-line font-mono text-sm text-muted" aria-hidden>
              .sol
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-3xl font-semibold tracking-[-0.02em]">{c.name}</h1>
              {c.verification === "verified" ? <span className="rounded px-1.5 py-0.5 text-xs text-verdigris ring-1 ring-verdigris/30">Verified source</span> : null}
            </div>
            <p className="text-sm text-muted">
              <span className="font-mono text-ink">{c.contractName}</span>, {fns.reads.length} read and {fns.writes.length} write functions
              {c.compilerVersion ? `, solc ${c.compilerVersion.replace(/^v/, "").split("+")[0]}` : ""}
              {c.verificationMessage && c.origin === "imported" ? `. ${c.verificationMessage}` : ""}
            </p>
            {deployed && net ? (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                {net.slug === "local" ? <span className="rounded-full border border-line px-2 py-0.5 text-[11px]">Local devnet</span> : <NetworkChip network={net.slug} />}
                {net.explorerUrl ? (
                  <a href={`${net.explorerUrl}/address/${c.address}`} target="_blank" rel="noreferrer" className="font-mono hover:text-ink hover:underline">
                    {c.address}
                  </a>
                ) : (
                  <span className="font-mono">{c.address}</span>
                )}
                {c.deployedAt ? <span>deployed {sinceNow(c.deployedAt)}</span> : null}
              </div>
            ) : (
              <p className="text-xs text-muted">Compiled {sinceNow(c.createdAt)}, not deployed yet.</p>
            )}
          </div>
        </div>
        {deployed && c.origin !== "imported" && net?.slug !== "local" && can({ contract: ["deploy"] }) ? <VerifyButton id={c.id} state={c.verification} /> : null}
      </header>

      {c.verification === "failed" && c.verificationMessage ? (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm">
          <span className="font-medium text-danger">Verification failed.</span> <span className="text-muted">{c.verificationMessage}</span>
        </p>
      ) : null}

      <SectionTabs label="Contract sections" fallback={fallbackTab} tabs={tabs} />

      {tab === "interact" && deployed && net ? (
        <Suspense fallback={<p className="text-sm text-muted">Reading the contract…</p>}>
          <Interact id={c.id} abi={c.abi} address={c.address!} chainId={c.chainId!} network={net.slug} explorerUrl={net.explorerUrl} canWrite={can({ contract: ["deploy"] })} />
        </Suspense>
      ) : tab === "deploy" && !deployed && c.bytecode ? (
        can({ contract: ["deploy"] }) ? (
          <DeployPanel
            id={c.id}
            abi={c.abi}
            bytecode={c.bytecode as `0x${string}`}
            pending={c.status === "deploying" && c.network && c.deployTxHash ? { network: c.network, txHash: c.deployTxHash } : null}
            networks={STUDIO_NETWORKS.map((s) => {
              const n = studioNetwork(s)!;
              return { slug: n.slug, name: n.name, chainId: n.chainId, explorerUrl: n.explorerUrl, faucet: FAUCETS[s] };
            })}
          />
        ) : (
          <p className="text-sm text-muted">Your role can&apos;t deploy contracts.</p>
        )
      ) : tab === "settings" ? (
        <div className="flex max-w-3xl flex-col gap-8">
          <div className="grid gap-5 rounded-xl border border-line bg-surface p-5 sm:grid-cols-2">
            {c.address ? <CopyField label="Address" value={c.address} /> : null}
            {c.deployTxHash ? <CopyField label="Deployment transaction" value={c.deployTxHash} /> : null}
            {c.deployer ? <CopyField label="Deployed by wallet" value={c.deployer} /> : null}
            {c.constructorArgs && c.constructorArgs !== "0x" ? <CopyField label="Constructor arguments (ABI-encoded)" value={c.constructorArgs} /> : null}
            <CopyField label="Studio ID" value={c.id} />
          </div>
          {can({ contract: ["delete"] }) ? (
            <div className="flex flex-col gap-3 rounded-xl border border-danger/40 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">{deployed ? "Removing it here doesn't touch the chain." : "Deletes the draft and its compiled code."}</p>
              <RemoveContract id={c.id} name={c.name} deployed={deployed} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {c.source ? (
            <div className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium">Source</span>
              <SolidityCode source={c.source} maxHeight="40rem" />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-sm font-medium">
              ABI <span className="font-normal text-muted">({c.abi.length} entries{constructorOf(c.abi).length ? `, constructor takes ${constructorOf(c.abi).length}` : ""})</span>
            </span>
            <CodeBlock code={JSON.stringify(c.abi, null, 2)} />
          </div>
        </div>
      )}
    </>
  );
}

async function Interact(props: { id: string; abi: unknown[]; address: string; chainId: number; network: string; explorerUrl: string; canWrite: boolean }) {
  const reads = await initialReads(props.abi, props.chainId, props.address);
  return <InteractPanel {...props} initialReads={reads} />;
}
