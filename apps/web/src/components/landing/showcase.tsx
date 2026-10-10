"use client";

import { formatUnits } from "viem";
import { useBalance } from "wagmi";
import { base, mainnet } from "wagmi/chains";

const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="theme-dark deep-surface overflow-x-auto rounded-lg p-4 font-mono text-[12.5px] leading-relaxed">
      {children}
    </pre>
  );
}

const k = "text-[#8fb6ff]";
const str = "text-[#5fd0bc]";
const num = "text-[#e0a94e]";
const dim = "text-muted";

function LiveBalance({ chainId, label }: { chainId: typeof mainnet.id | typeof base.id; label: string }) {
  const { data, isPending } = useBalance({ address: VITALIK, chainId });
  const eth = data ? Number(formatUnits(data.value, data.decimals)) : null;
  return (
    <div className="flex flex-col gap-1 px-5 py-5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-2xl tabular-nums">
        {eth !== null ? eth.toLocaleString("en", { maximumFractionDigits: 3 }) : isPending ? "…" : "n/a"}
        <span className="ml-1.5 text-sm text-muted">ETH</span>
      </dd>
    </div>
  );
}

export function ExplorerArtifact() {
  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div className="flex min-w-0 flex-col">
          <span className="text-lg font-medium">vitalik.eth</span>
          <span className="truncate font-mono text-xs text-muted">{VITALIK}</span>
        </div>
        <span className="shrink-0 rounded bg-verdigris-soft px-1.5 py-0.5 text-xs text-verdigris">Live</span>
      </div>
      <dl className="grid grid-cols-2 divide-x divide-line">
        <LiveBalance chainId={mainnet.id} label="On Ethereum" />
        <LiveBalance chainId={base.id} label="On Base" />
      </dl>
      <p className="border-t border-line px-5 py-3 text-xs text-muted">
        Read from the chain as this page loaded. Tokens, NFTs and history arrive with the explorer.
      </p>
    </div>
  );
}

function Bubble({ title, body, time }: { title: string; body: React.ReactNode; time: string }) {
  return (
    <div className="flex items-end gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-paper" aria-hidden>
        S
      </span>
      <div className="max-w-md rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
        <p className="mt-1.5 text-right text-[11px] text-muted">{time}</p>
      </div>
    </div>
  );
}

export function MonitorArtifact() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-paper p-5">
      <p className="pl-12 text-xs text-muted">Systema alerts, Telegram</p>
      <Bubble
        title="Treasury received 25,000 USDC"
        body={
          <>
            From <span className="font-mono">0x4b1e…a90c</span> on Base, block 52,424,118. Rule: incoming transfers above
            10,000 USDC.
          </>
        }
        time="14:02"
      />
      <Bubble
        title="Ownership transferred on AcmeVault"
        body={
          <>
            <span className="font-mono">OwnershipTransferred</span> emitted on Ethereum. New owner{" "}
            <span className="font-mono">0x91c2…07fe</span>.
          </>
        }
        time="14:09"
      />
      <p className="pl-12 text-xs text-muted">The same events reach your backend as signed webhooks.</p>
    </div>
  );
}

export function ApiArtifact() {
  return (
    <Code>
      <span className={dim}>$</span> curl api.systema.dev/v1/addresses/0xd8dA…6045/tokens \{"\n"}
      {"    "}-H <span className={str}>&quot;x-api-key: w3s_live_…&quot;</span>
      {"\n\n"}
      {"{"}
      {"\n  "}
      <span className={k}>&quot;chain&quot;</span>: <span className={str}>&quot;base&quot;</span>,{"\n  "}
      <span className={k}>&quot;tokens&quot;</span>: [{"\n    "}
      {"{ "}
      <span className={k}>&quot;symbol&quot;</span>: <span className={str}>&quot;USDC&quot;</span>, <span className={k}>&quot;balance&quot;</span>:{" "}
      <span className={str}>&quot;1520.42&quot;</span>
      {" }"},{"\n    "}
      {"{ "}
      <span className={k}>&quot;symbol&quot;</span>: <span className={str}>&quot;DEGEN&quot;</span>, <span className={k}>&quot;balance&quot;</span>:{" "}
      <span className={str}>&quot;88000&quot;</span>
      {" }"}
      {"\n  "}],{"\n  "}
      <span className={k}>&quot;rateLimit&quot;</span>: {"{ "}
      <span className={k}>&quot;remaining&quot;</span>: <span className={num}>598</span>
      {" }"}
      {"\n}"}
    </Code>
  );
}

export function StudioArtifact() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-line">
      <Code>
        <span className={k}>import</span> <span className={str}>&quot;@openzeppelin/contracts/token/ERC20/ERC20.sol&quot;</span>;
        {"\n\n"}
        <span className={k}>contract</span> AcmePoints <span className={k}>is</span> ERC20 {"{"}
        {"\n    "}
        <span className={k}>constructor</span>() ERC20(<span className={str}>&quot;Acme Points&quot;</span>,{" "}
        <span className={str}>&quot;ACME&quot;</span>) {"{"}
        {"\n        "}_mint(msg.sender, <span className={num}>1_000_000</span> * <span className={num}>1e18</span>);
        {"\n    }"}
        {"\n}"}
      </Code>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3 text-sm">
        <span className="text-muted">Compiled with solc 0.8.28, 0 warnings</span>
        <span className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper">Deploy to Base Sepolia</span>
      </div>
    </div>
  );
}
