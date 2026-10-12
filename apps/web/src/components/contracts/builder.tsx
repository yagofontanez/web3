"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { DEFAULT_ERC20, DEFAULT_ERC721, generate, validateOptions, type Erc20Options, type Erc721Options, type TemplateOptions } from "@w3s/contracts/templates";
import { compileCheck, createDraft } from "@/app/(app)/dashboard/contracts/actions";
import { Button } from "../ui";
import { SolidityCode } from "./solidity-code";

type Mode = "erc20" | "erc721" | "custom";

const CUSTOM_STARTER = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Counter is Ownable {
    uint256 public count;

    event Incremented(address indexed by, uint256 newCount);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function increment() public {
        count += 1;
        emit Incremented(msg.sender, count);
    }

    function reset() public onlyOwner {
        count = 0;
    }
}
`;

const field = "flex flex-col gap-1.5 text-sm";
const control = "h-10 rounded-md border border-line bg-paper px-3 text-sm placeholder:text-muted focus:border-verdigris focus:outline-none";

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${checked ? "border-verdigris bg-verdigris-soft/40" : "border-line hover:border-muted"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-[var(--verdigris)]" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}

export function ContractBuilder({ initial }: { initial: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initial);
  const [erc20, setErc20] = useState<Erc20Options>(DEFAULT_ERC20);
  const [erc721, setErc721] = useState<Erc721Options>(DEFAULT_ERC721);
  const [custom, setCustom] = useState({ name: "Counter", source: CUSTOM_STARTER });
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<{ message: string; line: number | null }[]>([]);
  const [check, setCheck] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const options: TemplateOptions | null = mode === "erc20" ? erc20 : mode === "erc721" ? erc721 : null;
  const preview = useMemo(() => (options ? generate(options) : null), [options]);
  const problem = options ? validateOptions(options) : null;

  function submit() {
    setError(null);
    setDetails([]);
    start(async () => {
      const r = await createDraft(options ? { mode: "template", options } : { mode: "custom", name: custom.name, source: custom.source });
      if (!r.ok) {
        setError(r.error);
        setDetails(r.details ?? []);
        return;
      }
      router.push(`/dashboard/contracts/${r.data.id}?tab=deploy`);
    });
  }

  function runCheck() {
    setError(null);
    setDetails([]);
    setCheck(null);
    start(async () => {
      const r = await compileCheck(custom.source);
      if (!r.ok) {
        setError(r.error);
        setDetails(r.details ?? []);
        return;
      }
      setCheck(`Compiles. Deploys ${r.data.contractName}${r.data.warnings ? ` with ${r.data.warnings} warning${r.data.warnings > 1 ? "s" : ""}` : " with no warnings"}.`);
    });
  }

  const tabs: { id: Mode; label: string; hint: string }[] = [
    { id: "erc20", label: "Token (ERC-20)", hint: "Fungible points, credits or a currency" },
    { id: "erc721", label: "NFT (ERC-721)", hint: "Passes, badges or collectibles" },
    { id: "custom", label: "Your own Solidity", hint: "Paste a contract, OpenZeppelin imports work" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div role="radiogroup" aria-label="Contract type" className="grid gap-2 sm:grid-cols-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={mode === t.id}
            onClick={() => {
              setMode(t.id);
              setError(null);
              setDetails([]);
            }}
            className={`flex flex-col items-start gap-0.5 rounded-xl border p-4 text-left ${mode === t.id ? "border-verdigris bg-verdigris-soft/40" : "border-line bg-surface hover:border-muted"}`}
          >
            <span className="font-semibold">{t.label}</span>
            <span className="text-xs text-muted">{t.hint}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start">
        <div className="flex flex-col gap-6">
          {mode === "custom" ? (
            <>
              <label className={field}>
                <span className="font-medium">Name in Systema</span>
                <input className={control} value={custom.name} onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} maxLength={60} />
              </label>
              <p className="text-sm text-muted">
                Edit the source on the right. Imports from <span className="font-mono text-ink">@openzeppelin/contracts</span> resolve automatically. The last deployable contract in the file is the one that gets deployed.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={runCheck} disabled={pending}>
                  {pending ? "Compiling…" : "Check it compiles"}
                </Button>
              </div>
            </>
          ) : mode === "erc20" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <label className={field}>
                  <span className="font-medium">Name</span>
                  <input className={control} value={erc20.name} onChange={(e) => setErc20({ ...erc20, name: e.target.value })} maxLength={50} />
                </label>
                <label className={field}>
                  <span className="font-medium">Symbol</span>
                  <input className={`${control} font-mono uppercase`} value={erc20.symbol} onChange={(e) => setErc20({ ...erc20, symbol: e.target.value.toUpperCase() })} maxLength={11} />
                </label>
              </div>
              <label className={field}>
                <span className="font-medium">Initial supply</span>
                <input className={`${control} font-mono`} inputMode="numeric" value={erc20.premint} onChange={(e) => setErc20({ ...erc20, premint: e.target.value.replace(/[^\d]/g, "") })} />
                <span className="text-xs text-muted">Whole tokens minted to you when it deploys. 18 decimals.</span>
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Mintable" hint="You can create more tokens later" checked={erc20.mintable} onChange={(v) => setErc20({ ...erc20, mintable: v })} />
                <Toggle label="Burnable" hint="Holders can destroy their tokens" checked={erc20.burnable} onChange={(v) => setErc20({ ...erc20, burnable: v })} />
                <Toggle label="Pausable" hint="You can freeze all transfers" checked={erc20.pausable} onChange={(v) => setErc20({ ...erc20, pausable: v })} />
                <Toggle label="Permit" hint="Gasless approvals with signatures (EIP-2612)" checked={erc20.permit} onChange={(v) => setErc20({ ...erc20, permit: v })} />
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <label className={field}>
                  <span className="font-medium">Name</span>
                  <input className={control} value={erc721.name} onChange={(e) => setErc721({ ...erc721, name: e.target.value })} maxLength={50} />
                </label>
                <label className={field}>
                  <span className="font-medium">Symbol</span>
                  <input className={`${control} font-mono uppercase`} value={erc721.symbol} onChange={(e) => setErc721({ ...erc721, symbol: e.target.value.toUpperCase() })} maxLength={11} />
                </label>
              </div>
              <label className={field}>
                <span className="font-medium">
                  Base URI <span className="font-normal text-muted">(optional)</span>
                </span>
                <input className={`${control} font-mono`} value={erc721.baseUri} onChange={(e) => setErc721({ ...erc721, baseUri: e.target.value.trim() })} placeholder="ipfs://…/ or https://…/" />
                <span className="text-xs text-muted">Token 7 resolves to this URI followed by 7.</span>
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Mintable" hint="You can mint new tokens to any address" checked={erc721.mintable} onChange={(v) => setErc721({ ...erc721, mintable: v })} />
                <Toggle label="Burnable" hint="Holders can destroy their tokens" checked={erc721.burnable} onChange={(v) => setErc721({ ...erc721, burnable: v })} />
                <Toggle label="Pausable" hint="You can freeze all transfers" checked={erc721.pausable} onChange={(v) => setErc721({ ...erc721, pausable: v })} />
              </div>
            </>
          )}

          <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-sm">
            <span className="font-medium">What happens next</span>
            <span className="text-muted">We compile it with solc 0.8.37 and OpenZeppelin 5.6. Then you deploy it to Sepolia or Base Sepolia from your own wallet. The ownership goes to the wallet that deploys.</span>
          </div>

          {problem ? <p className="text-sm text-amber">{problem}</p> : null}
          {error ? (
            <div role="alert" className="flex flex-col gap-1 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm">
              <span className="font-medium text-danger">{error}</span>
              {details.map((d, i) => (
                <span key={i} className="font-mono text-xs text-muted">
                  {d.line ? `Line ${d.line}: ` : ""}
                  {d.message}
                </span>
              ))}
            </div>
          ) : null}
          {check ? <p className="text-sm text-verdigris">{check}</p> : null}
          <div>
            <Button onClick={submit} disabled={pending || !!problem}>
              {pending ? "Compiling…" : "Compile and continue"}
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-10">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{mode === "custom" ? "Source" : "Generated source"}</span>
            {preview ? <span className="font-mono text-xs text-muted">{preview.contractName}.sol</span> : null}
          </div>
          {mode === "custom" ? (
            <textarea
              value={custom.source}
              onChange={(e) => {
                setCustom((c) => ({ ...c, source: e.target.value }));
                setCheck(null);
              }}
              spellCheck={false}
              className="theme-dark deep-surface min-h-[32rem] rounded-lg p-4 font-mono text-[12.5px] leading-[1.65] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-verdigris"
              aria-label="Solidity source"
            />
          ) : (
            <SolidityCode source={preview?.source ?? ""} highlightLines={[]} />
          )}
        </div>
      </div>
    </div>
  );
}
