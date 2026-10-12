"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Abi } from "viem";
import { useWalletClient } from "wagmi";
import { constructorOf, parseArgs, placeholder } from "@w3s/contracts/abi";
import { confirmDeployment, recordDeployment } from "@/app/(app)/dashboard/contracts/actions";
import { Button, FormError } from "../ui";
import { useTargetChain, walletError, WalletGate } from "./wallet";

type Net = { slug: string; name: string; chainId: number; explorerUrl: string; faucet: { name: string; url: string } };
type Step = "idle" | "signing" | "submitted" | "deployed" | "failed";

export function DeployPanel({
  id,
  abi,
  bytecode,
  networks,
  pending,
}: {
  id: string;
  abi: unknown[];
  bytecode: `0x${string}`;
  networks: Net[];
  pending: { network: string; txHash: string } | null;
}) {
  const router = useRouter();
  const [netSlug, setNetSlug] = useState(pending?.network ?? networks[0]!.slug);
  const net = networks.find((n) => n.slug === netSlug)!;
  const ctorInputs = constructorOf(abi);
  const target = useTargetChain(net.chainId);
  const account = target.connection.address;
  const [values, setValues] = useState<string[]>(() => ctorInputs.map(() => ""));
  const [step, setStep] = useState<Step>(pending ? "submitted" : "idle");
  const [hash, setHash] = useState<string | null>(pending?.txHash ?? null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: walletClient } = useWalletClient({ chainId: net.chainId });

  const filled = ctorInputs.map((inp, i) => values[i] || (inp.type === "address" && account ? account : ""));

  useEffect(() => {
    if (step !== "submitted") return;
    let cancelled = false;
    const poll = async () => {
      const r = await confirmDeployment(id);
      if (cancelled || !r.ok) return;
      if (r.data.status === "deployed") {
        setAddress(r.data.address ?? null);
        setStep("deployed");
        setTimeout(() => router.push(`/dashboard/contracts/${id}?tab=interact`), 1800);
      } else if (r.data.status === "failed") {
        setStep("failed");
        setError("The deployment transaction reverted on-chain. Check the constructor arguments and try again.");
      }
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [step, id, router]);

  async function deploy() {
    setError(null);
    if (!walletClient || !account) return setError("Connect your wallet first.");
    let args: unknown[];
    try {
      args = parseArgs(ctorInputs, filled);
    } catch (err) {
      return setError(err instanceof Error ? err.message : String(err));
    }
    setStep("signing");
    try {
      const txHash = await walletClient.deployContract({ abi: abi as Abi, bytecode, args, account, chain: walletClient.chain });
      setHash(txHash);
      const r = await recordDeployment(id, { network: net.slug, txHash, deployer: account });
      if (!r.ok) throw new Error(r.error);
      setStep("submitted");
    } catch (err) {
      setStep("idle");
      setError(walletError(err));
    }
  }

  const steps: { key: Step; label: string; detail: React.ReactNode }[] = [
    { key: "signing", label: "Sign in your wallet", detail: "Your wallet shows the deployment and its gas cost." },
    {
      key: "submitted",
      label: "Waiting for the network",
      detail: hash ? (
        net.explorerUrl ? (
          <a href={`${net.explorerUrl}/tx/${hash}`} target="_blank" rel="noreferrer" className="font-mono hover:underline">
            {hash.slice(0, 18)}…
          </a>
        ) : (
          <span className="font-mono">{hash.slice(0, 18)}…</span>
        )
      ) : (
        "Usually 10 to 30 seconds on testnets."
      ),
    },
    {
      key: "deployed",
      label: "Live on-chain",
      detail: address ? (
        <span className="font-mono">{address}</span>
      ) : (
        "You'll land on the interact tab."
      ),
    },
  ];
  const order: Step[] = ["idle", "signing", "submitted", "deployed"];
  const at = order.indexOf(step === "failed" ? "submitted" : step);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2" disabled={step !== "idle"}>
          <legend className="mb-2 text-sm font-medium">Network</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {networks.map((n) => (
              <button
                key={n.slug}
                type="button"
                role="radio"
                aria-checked={n.slug === netSlug}
                onClick={() => setNetSlug(n.slug)}
                className={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left disabled:opacity-60 ${n.slug === netSlug ? "border-verdigris bg-verdigris-soft/40" : "border-line hover:border-muted"}`}
              >
                <span className="text-sm font-medium">{n.name}</span>
                <span className="font-mono text-xs text-muted">chain {n.chainId}</span>
              </button>
            ))}
          </div>
          <a href={net.faucet.url} target="_blank" rel="noreferrer" className="w-fit text-xs text-muted hover:text-ink hover:underline">
            Need test ETH? {net.faucet.name}
          </a>
        </fieldset>

        {ctorInputs.length > 0 ? (
          <fieldset className="flex flex-col gap-3" disabled={step !== "idle"}>
            <legend className="mb-1 text-sm font-medium">Constructor</legend>
            {ctorInputs.map((inp, i) => (
              <label key={i} className="flex flex-col gap-1.5 text-sm">
                <span className="flex items-baseline gap-2">
                  <span className="font-mono">{inp.name || `arg${i}`}</span>
                  <span className="text-xs text-muted">{inp.type}</span>
                </span>
                <input
                  className="h-10 rounded-md border border-line bg-paper px-3 font-mono text-sm placeholder:text-muted focus:border-verdigris focus:outline-none"
                  value={values[i] ?? ""}
                  placeholder={inp.type === "address" && account ? `${account} (your wallet)` : placeholder(inp)}
                  onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {inp.name === "initialOwner" ? <span className="text-xs text-muted">Defaults to the wallet that deploys.</span> : null}
              </label>
            ))}
          </fieldset>
        ) : null}

        <FormError message={error} />
        {step === "idle" || step === "failed" ? (
          <WalletGate chainId={net.chainId} networkName={net.name}>
            <Button onClick={deploy} className="self-start">
              Deploy to {net.name}
            </Button>
          </WalletGate>
        ) : null}
      </div>

      <ol className="flex flex-col gap-0 rounded-xl border border-line bg-surface p-5" aria-label="Deployment progress">
        {steps.map((s, i) => {
          const idx = i + 1;
          const done = at > idx || step === "deployed";
          const active = at === idx && step !== "deployed";
          return (
            <li key={s.key} className="relative flex gap-3 pb-6 last:pb-0">
              {i < steps.length - 1 ? <span aria-hidden className={`absolute top-7 bottom-0 left-[13px] w-px ${done ? "bg-verdigris" : "bg-line"}`} /> : null}
              <span
                className={`relative grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  done ? "bg-verdigris text-white" : active ? "bg-paper text-ink ring-2 ring-verdigris" : "bg-paper text-muted ring-1 ring-line"
                }`}
              >
                {done ? "✓" : idx}
                {active ? <span aria-hidden className="absolute inset-0 animate-ping rounded-full ring-2 ring-verdigris/40" /> : null}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                <span className={`text-sm font-medium ${done || active ? "" : "text-muted"}`}>{s.label}</span>
                <span className="text-xs break-all text-muted">{s.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
