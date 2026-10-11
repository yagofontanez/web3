"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getAddress, isAddress } from "viem";
import { useConnect, useConnection, useConnectors } from "wagmi";
import { HashGlyph } from "../chain/hash-glyph";
import { AddressGlyph } from "./address-glyph";

type Preview =
  | { state: "idle" }
  | { state: "invalid" }
  | { state: "address"; address: string }
  | { state: "resolving"; name: string }
  | { state: "resolved"; name: string; address: string }
  | { state: "not_found"; name: string };

const EXAMPLES = [
  { name: "vitalik.eth", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
  { name: "jesse.base.eth", address: "0x2211d1D0020DAEA8039E46Cf1367962070d77DA9" },
  { name: "brantly.eth", address: "0x983110309620D911731Ac0932219af06091b6744" },
  { name: "nick.eth", address: "0xb8c2C29ee19D8307cb7255e1Cd9CbDE883A267d5" },
];

const looksLikeName = (q: string) => /^[^\s.]+(\.[^\s.]+)+$/.test(q) && !q.startsWith("0x");
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function SmartSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [preview, setPreview] = useState<Preview>({ state: "idle" });
  const [submitted, setSubmitted] = useState(false);
  const connection = useConnection();
  const connectors = useConnectors();
  const { connectAsync, isPending } = useConnect();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) && !target.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = value.trim();
    if (!looksLikeName(q)) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/explorer/resolve?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = (await res.json()) as { ok: boolean; address?: string; reason?: string };
        setPreview(data.ok && data.address ? { state: "resolved", name: q, address: data.address } : { state: "not_found", name: q });
      } catch {}
    }, 350);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [value]);

  function onChange(next: string) {
    setValue(next);
    setSubmitted(false);
    const q = next.trim();
    if (!q) return setPreview({ state: "idle" });
    if (isAddress(q, { strict: false })) return setPreview({ state: "address", address: getAddress(q) });
    if (looksLikeName(q)) return setPreview({ state: "resolving", name: q });
    setPreview({ state: "invalid" });
  }

  function open(target: string) {
    router.push(`/dashboard/explorer/${encodeURIComponent(target)}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (preview.state === "address") return open(preview.address);
    if (preview.state === "resolved") return open(preview.name);
    if (preview.state === "resolving") return open(preview.name);
    inputRef.current?.focus();
  }

  async function useWallet() {
    try {
      let address = connection.address;
      if (!address) {
        const connector = connectors[0];
        if (!connector) return;
        address = (await connectAsync({ connector })).accounts[0];
      }
      if (address) open(address);
    } catch {}
  }

  const glyphAddress = preview.state === "address" || preview.state === "resolved" ? preview.address : null;
  const ok = glyphAddress !== null;

  let hint: React.ReactNode = (
    <>
      Paste a <span className="font-mono">0x</span> address or type a name like vitalik.eth. Press <kbd className="rounded border border-line bg-paper px-1 font-mono text-[11px]">/</kbd> to search from anywhere on this page.
    </>
  );
  if (preview.state === "address") hint = <>Valid address. Press Enter to open it.</>;
  if (preview.state === "resolving") hint = <>Looking up {preview.name}…</>;
  if (preview.state === "resolved")
    hint = (
      <>
        {preview.name} points to <span className="font-mono text-ink">{short(preview.address)}</span>. Press Enter to open it.
      </>
    );
  if (preview.state === "not_found") hint = <span className="text-danger">{preview.name} doesn&apos;t point to an address. Check the spelling.</span>;
  if (preview.state === "invalid" && submitted)
    hint = <span className="text-danger">That isn&apos;t an address or a name. Addresses start with 0x and have 40 hex characters.</span>;

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} role="search" className="flex flex-col gap-2.5">
        <div
          className={`flex items-center gap-3 rounded-xl border bg-surface p-2 pl-2.5 transition-colors focus-within:border-verdigris ${
            preview.state === "not_found" || (preview.state === "invalid" && submitted) ? "border-danger" : "border-line"
          }`}
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-paper p-1" aria-hidden>
            {ok ? (
              <AddressGlyph address={glyphAddress} className="size-9 ring-0" />
            ) : (
              <HashGlyph animate={false} gap={0.2} className={`size-9 ${preview.state === "resolving" ? "animate-pulse" : ""}`} />
            )}
          </span>
          <label htmlFor="explorer-smart" className="sr-only">
            Address or name
          </label>
          <input
            id="explorer-smart"
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="0x… address or name.eth"
            className="h-11 min-w-0 flex-1 bg-transparent font-mono text-base placeholder:font-sans placeholder:text-muted focus:outline-none sm:text-lg"
          />
          <button
            type="submit"
            disabled={preview.state === "not_found"}
            className="h-11 shrink-0 rounded-lg bg-ink px-5 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-40"
          >
            Look up
          </button>
        </div>
        <p className="min-h-5 px-1 text-sm text-muted" aria-live="polite">
          {hint}
        </p>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={useWallet}
          disabled={isPending}
          className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-sm hover:border-muted disabled:opacity-50"
        >
          {connection.address ? (
            <AddressGlyph address={connection.address} className="size-6 rounded-full p-0.5" />
          ) : (
            <span className="grid size-6 place-items-center rounded-full bg-ink text-[11px] text-paper" aria-hidden>
              +
            </span>
          )}
          {connection.address ? `My wallet ${short(connection.address)}` : isPending ? "Connecting…" : "Connect my wallet"}
        </button>
        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
        {EXAMPLES.map((e) => (
          <Link
            key={e.name}
            href={`/dashboard/explorer/${e.name}`}
            className="flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 text-sm text-muted hover:border-muted hover:text-ink"
          >
            <AddressGlyph address={e.address} className="size-6 rounded-full p-0.5" />
            {e.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
