"use client";

import { useState } from "react";
import { createContext, use } from "react";
import { formatUnits, parseEther, parseUnits, type Abi } from "viem";
import { useWalletClient } from "wagmi";
import { functionsOf, parseArgs, placeholder, type AbiFunction } from "@w3s/contracts/abi";
import { readFunction, transactionStatus } from "@/app/(app)/dashboard/contracts/actions";
import { Button } from "../ui";
import { useTargetChain, walletError, WalletGate } from "./wallet";

const sig = (f: AbiFunction) => `${f.name}(${f.inputs.map((i) => i.type).join(",")})`;

type TokenUnits = { decimals: number; symbol: string } | null;
const Units = createContext<TokenUnits>(null);
const AMOUNT_NAMES = /^(_?amount|_?value|wad|_?amt|_?qty|subtractedValue|addedValue)$/i;
const AMOUNT_OUTPUTS = new Set(["totalSupply", "balanceOf", "allowance", "cap", "maxSupply"]);

function asTokens(raw: string, units: NonNullable<TokenUnits>) {
  try {
    const exact = formatUnits(BigInt(raw), units.decimals);
    return Number(exact) >= 1 ? Number(exact).toLocaleString("en", { maximumFractionDigits: 6 }) : exact;
  } catch {
    return null;
  }
}

function UnitHint({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const units = use(Units);
  if (!units) return null;
  const trimmed = value.trim();
  let converted: string | null = null;
  try {
    converted = trimmed && /^\d+(\.\d+)?$/.test(trimmed) ? parseUnits(trimmed, units.decimals).toString() : null;
  } catch {}
  const preview = /^\d+$/.test(trimmed) ? asTokens(trimmed, units) : null;
  return (
    <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
      <span>Smallest units.</span>
      {preview ? (
        <span>
          {trimmed} = <span className="font-mono text-ink">{preview}</span> {units.symbol}
        </span>
      ) : null}
      {converted && converted !== trimmed ? (
        <button type="button" onClick={() => onChange(converted!)} className="text-verdigris hover:underline">
          Treat {trimmed} as {units.symbol}
        </button>
      ) : null}
    </span>
  );
}

function Inputs({ f, values, onChange, value, setValue }: { f: AbiFunction; values: string[]; onChange: (v: string[]) => void; value?: string; setValue?: (v: string) => void }) {
  return (
    <>
      {f.inputs.map((inp, i) => (
        <label key={i} className="flex flex-col gap-1 text-xs">
          <span className="flex gap-2">
            <span className="font-mono text-ink">{inp.name || `arg${i}`}</span>
            <span className="text-muted">{inp.type}</span>
          </span>
          <input
            className="h-9 rounded-md border border-line bg-paper px-2.5 font-mono text-[13px] placeholder:text-muted focus:border-verdigris focus:outline-none"
            value={values[i] ?? ""}
            placeholder={placeholder(inp)}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
          />
          {/^uint/.test(inp.type) && AMOUNT_NAMES.test(inp.name ?? "") ? (
            <UnitHint value={values[i] ?? ""} onChange={(v) => onChange(values.map((x, j) => (j === i ? v : x)))} />
          ) : null}
        </label>
      ))}
      {f.stateMutability === "payable" && setValue ? (
        <label className="flex flex-col gap-1 text-xs">
          <span className="flex gap-2">
            <span className="font-mono text-ink">value</span>
            <span className="text-muted">ETH sent with the call</span>
          </span>
          <input className="h-9 rounded-md border border-line bg-paper px-2.5 font-mono text-[13px] focus:border-verdigris focus:outline-none" value={value} placeholder="0.01" onChange={(e) => setValue(e.target.value)} />
        </label>
      ) : null}
    </>
  );
}

function ReadFn({ id, f, auto }: { id: string; f: AbiFunction; auto: string | undefined }) {
  const units = use(Units);
  const [values, setValues] = useState<string[]>(() => f.inputs.map(() => ""));
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(auto !== undefined ? { ok: true, text: auto } : null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    const r = await readFunction(id, sig(f), values);
    setBusy(false);
    setResult(r.ok ? { ok: true, text: r.data.value } : { ok: false, text: r.error });
  }
  return (
    <li className="flex flex-col gap-2.5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm">{f.name}</span>
        {f.inputs.length ? (
          <Button variant="secondary" className="h-8 px-3 text-xs" onClick={run} disabled={busy}>
            {busy ? "Reading…" : "Read"}
          </Button>
        ) : null}
      </div>
      {f.inputs.length ? <Inputs f={f} values={values} onChange={setValues} /> : null}
      {result ? (
        <output className={`rounded-md px-2.5 py-1.5 font-mono text-[13px] break-all ${result.ok ? "bg-paper text-ink" : "bg-danger/10 text-danger"}`}>
          {result.text || "(empty)"}
          {result.ok && units && AMOUNT_OUTPUTS.has(f.name) && /^\d+$/.test(result.text) ? (
            <span className="ml-2 font-sans text-xs text-muted">
              = {asTokens(result.text, units)} {units.symbol}
            </span>
          ) : null}
        </output>
      ) : null}
    </li>
  );
}

function WriteFn({ f, address, chainId, explorerUrl, network }: { f: AbiFunction; address: string; chainId: number; explorerUrl: string; network: string }) {
  const [values, setValues] = useState<string[]>(() => f.inputs.map(() => ""));
  const [value, setValue] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "signing" | "pending" | "success" | "reverted" | "error"; text?: string; hash?: string }>({ kind: "idle" });
  const { data: walletClient } = useWalletClient({ chainId });
  const target = useTargetChain(chainId);

  async function run() {
    if (!walletClient || !target.connection.address) return;
    let args: unknown[];
    try {
      args = parseArgs(f.inputs, values);
    } catch (err) {
      return setState({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    }
    setState({ kind: "signing" });
    try {
      const hash = await walletClient.writeContract({
        address: address as `0x${string}`,
        abi: [f] as Abi,
        functionName: f.name,
        args,
        account: target.connection.address,
        chain: walletClient.chain,
        ...(f.stateMutability === "payable" && value ? { value: parseEther(value) } : {}),
      });
      setState({ kind: "pending", hash });
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const s = await transactionStatus(network, hash);
        if (s.ok && s.data.status !== "pending") {
          setState({ kind: s.data.status, hash, text: s.data.block ? `block ${s.data.block.toLocaleString("en")}` : undefined });
          return;
        }
      }
      setState({ kind: "pending", hash, text: "Still pending. Check the explorer." });
    } catch (err) {
      setState({ kind: "error", text: walletError(err) });
    }
  }

  const tone = state.kind === "success" ? "text-verdigris" : state.kind === "reverted" || state.kind === "error" ? "text-danger" : "text-muted";
  return (
    <li className="flex flex-col gap-2.5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-mono text-sm">
          {f.name}
          {f.stateMutability === "payable" ? <span className="rounded bg-amber-soft px-1 font-sans text-[10px] text-amber">payable</span> : null}
        </span>
        <WalletGate chainId={chainId} networkName="the contract's network">
          <Button className="h-8 px-3 text-xs" onClick={run} disabled={state.kind === "signing" || state.kind === "pending"}>
            {state.kind === "signing" ? "Confirm in wallet…" : state.kind === "pending" ? "Waiting…" : "Write"}
          </Button>
        </WalletGate>
      </div>
      <Inputs f={f} values={values} onChange={setValues} value={value} setValue={setValue} />
      {state.kind !== "idle" && state.kind !== "signing" ? (
        <p className={`text-xs ${tone}`}>
          {state.kind === "pending" ? "Submitted, waiting for a block. " : state.kind === "success" ? "Confirmed in " : state.kind === "reverted" ? "Reverted in " : ""}
          {state.text}
          {state.hash ? (
            <>
              {" "}
              {explorerUrl ? (
                <a href={`${explorerUrl}/tx/${state.hash}`} target="_blank" rel="noreferrer" className="font-mono underline-offset-2 hover:underline">
                  {state.hash.slice(0, 12)}…
                </a>
              ) : (
                <span className="font-mono">{state.hash.slice(0, 12)}…</span>
              )}
            </>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}

export function InteractPanel({
  id,
  abi,
  address,
  chainId,
  network,
  explorerUrl,
  initialReads,
  canWrite,
}: {
  id: string;
  abi: unknown[];
  address: string;
  chainId: number;
  network: string;
  explorerUrl: string;
  initialReads: Record<string, string>;
  canWrite: boolean;
}) {
  const { reads, writes } = functionsOf(abi);
  const [filter, setFilter] = useState("");
  const decimals = Number(initialReads["decimals()"]);
  const units: TokenUnits = Number.isInteger(decimals) && decimals > 0 && decimals <= 36 ? { decimals, symbol: initialReads["symbol()"] || "tokens" } : null;
  const match = (f: AbiFunction) => !filter || f.name.toLowerCase().includes(filter.toLowerCase());
  return (
    <Units value={units}>
      <div className="flex flex-col gap-5">
        {reads.length + writes.length > 12 ? (
          <input
            className="h-9 w-full max-w-sm rounded-md border border-line bg-surface px-3 text-sm placeholder:text-muted focus:border-verdigris focus:outline-none"
            placeholder={`Filter ${reads.length + writes.length} functions`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        ) : null}
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <section className="flex flex-col gap-3">
            <h2 className="flex items-baseline justify-between font-semibold">
              Read <span className="text-xs font-normal text-muted">free, no wallet needed</span>
            </h2>
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {reads.filter(match).map((f) => (
                <ReadFn key={sig(f)} id={id} f={f} auto={f.inputs.length === 0 ? initialReads[sig(f)] : undefined} />
              ))}
            </ul>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="flex items-baseline justify-between font-semibold">
              Write <span className="text-xs font-normal text-muted">signed by your wallet, costs gas</span>
            </h2>
            {canWrite ? (
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {writes.filter(match).map((f) => (
                  <WriteFn key={sig(f)} f={f} address={address} chainId={chainId} explorerUrl={explorerUrl} network={network} />
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">Your role can read this contract but not send transactions from the studio.</p>
            )}
          </section>
        </div>
      </div>
    </Units>
  );
}
