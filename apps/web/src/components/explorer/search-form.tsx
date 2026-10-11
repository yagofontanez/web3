"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useConnect, useConnection, useConnectors } from "wagmi";
import { Button, FormError } from "../ui";

const EXAMPLES = ["vitalik.eth", "brantly.eth", "nick.eth"];

export function SearchForm({ autoFocus = false, initial = "", compact = false }: { autoFocus?: boolean; initial?: string; compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const connection = useConnection();
  const connectors = useConnectors();
  const { connectAsync, isPending } = useConnect();

  function go(query: string) {
    const q = query.trim();
    if (!q) return setError("Enter an address or an ENS name.");
    if (!/^0x[0-9a-fA-F]{40}$/.test(q) && !q.includes(".")) {
      return setError("That isn't an address or an ENS name. Addresses start with 0x and have 40 hex characters.");
    }
    setError(null);
    router.push(`/dashboard/explorer/${encodeURIComponent(q)}`);
  }

  async function useWallet() {
    setError(null);
    try {
      let address = connection.address;
      if (!address) {
        const connector = connectors[0];
        if (!connector) return setError("No browser wallet found. Install MetaMask, Rabby or use Brave Wallet.");
        address = (await connectAsync({ connector })).accounts[0];
      }
      if (address) go(address);
    } catch {
      setError("Your wallet didn't share an account.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          go(value);
        }}
        className="flex flex-col gap-2 sm:flex-row"
        role="search"
      >
        <label htmlFor="explorer-q" className="sr-only">
          Address or ENS name
        </label>
        <input
          id="explorer-q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={autoFocus}
          spellCheck={false}
          autoComplete="off"
          placeholder="0x… address or name.eth"
          className={`${compact ? "h-10" : "h-11"} w-full min-w-0 shrink-0 rounded-md sm:w-auto sm:flex-1 border border-line bg-surface px-3.5 font-mono text-sm placeholder:font-sans placeholder:text-muted focus:border-verdigris focus:outline-none`}
        />
        <Button type="submit" className={`${compact ? "h-10" : "h-11"} px-5`}>
          Look up
        </Button>
      </form>
      <FormError message={error} />
      <div className={`${compact ? "hidden" : "flex"} flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted`}>
        <button type="button" onClick={useWallet} disabled={isPending} className="text-ink underline underline-offset-4 disabled:opacity-50">
          {connection.address ? "Look up my connected wallet" : isPending ? "Connecting…" : "Connect wallet and look it up"}
        </button>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          Try
          {EXAMPLES.map((e) => (
            <Link key={e} href={`/dashboard/explorer/${e}`} className="font-mono text-ink hover:underline">
              {e}
            </Link>
          ))}
        </span>
      </div>
    </div>
  );
}
