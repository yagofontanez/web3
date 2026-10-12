"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { importContract } from "@/app/(app)/dashboard/contracts/actions";
import { Button, FormError } from "../ui";

const EXAMPLES = [
  { network: "sepolia", address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", label: "WETH on Sepolia" },
  { network: "sepolia", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", label: "USDC on Sepolia (proxy)" },
  { network: "base-sepolia", address: "0x4200000000000000000000000000000000000006", label: "WETH on Base Sepolia" },
];

export function ImportForm({ networks }: { networks: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [network, setNetwork] = useState(networks[0]!.slug);
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await importContract({ network, address, name });
      if (!r.ok) return setError(r.error);
      router.push(`/dashboard/contracts/${r.data.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-5">
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Network">
        {networks.map((n) => (
          <button
            key={n.slug}
            type="button"
            role="radio"
            aria-checked={network === n.slug}
            onClick={() => setNetwork(n.slug)}
            className={`rounded-lg border p-3 text-left text-sm font-medium ${network === n.slug ? "border-verdigris bg-verdigris-soft/40" : "border-line hover:border-muted"}`}
          >
            {n.name}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Contract address</span>
        <input className="h-10 rounded-md border border-line bg-paper px-3 font-mono text-sm focus:border-verdigris focus:outline-none" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" required spellCheck={false} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">
          Name in Systema <span className="font-normal text-muted">(optional)</span>
        </span>
        <input className="h-10 rounded-md border border-line bg-paper px-3 text-sm focus:border-verdigris focus:outline-none" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Uses the verified contract name" />
      </label>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.address + ex.network}
            type="button"
            onClick={() => {
              setNetwork(ex.network);
              setAddress(ex.address);
            }}
            className="rounded-full border border-line px-2.5 py-0.5 text-muted hover:text-ink"
          >
            {ex.label}
          </button>
        ))}
      </div>
      <FormError message={error} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Fetching ABI…" : "Import contract"}
        </Button>
      </div>
    </form>
  );
}
