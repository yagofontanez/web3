"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { createMonitor, updateMonitor, type MonitorInput } from "@/app/(app)/dashboard/monitors/actions";
import { Button, FormError } from "../ui";
import { TelegramIcon, WebhookIcon } from "./channels";

type Network = { slug: string; name: string; testnet: boolean };
type Channel = { id: string; name: string; kind: "telegram" | "webhook" };
type Saved = { address: string; label: string; ensName: string | null };

const EVENT_PRESETS = [
  { label: "ERC-20 Transfer", signature: "Transfer(address indexed from, address indexed to, uint256 value)" },
  { label: "Ownership transferred", signature: "OwnershipTransferred(address indexed previousOwner, address indexed newOwner)" },
  { label: "Approval", signature: "Approval(address indexed owner, address indexed spender, uint256 value)" },
  { label: "Paused", signature: "Paused(address account)" },
];

const field = "flex flex-col gap-1.5 text-sm";
const control = "h-10 rounded-md border border-line bg-paper px-3 text-sm placeholder:text-muted focus:border-verdigris focus:outline-none";

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2 ${options.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left ${value === o.value ? "border-verdigris bg-verdigris-soft/40" : "border-line hover:border-muted"}`}
        >
          <span className="text-sm font-medium">{o.label}</span>
          {o.hint ? <span className="text-xs text-muted">{o.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}

export type MonitorFormValues = {
  kind: "transfer" | "event";
  name: string;
  network: string;
  address: string;
  direction: "in" | "out" | "any";
  assetMode: "any" | "native" | "token";
  token: string;
  minAmount: string;
  signature: string;
  channelIds: string[];
};

export function MonitorForm({
  networks,
  channels,
  saved,
  initial,
  monitorId,
}: {
  networks: Network[];
  channels: Channel[];
  saved: Saved[];
  initial?: Partial<MonitorFormValues>;
  monitorId?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<MonitorFormValues>({
    kind: "transfer",
    name: "",
    network: "ethereum",
    address: "",
    direction: "in",
    assetMode: "any",
    token: "",
    minAmount: "",
    signature: EVENT_PRESETS[1]!.signature,
    channelIds: channels.map((c) => c.id),
    ...initial,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof MonitorFormValues>(k: K, value: MonitorFormValues[K]) => setV((p) => ({ ...p, [k]: value }));
  const net = networks.find((n) => n.slug === v.network);
  const nativeSymbol = v.network === "polygon" ? "POL" : "ETH";

  const preview = useMemo(() => {
    const who = v.name || "Your monitor";
    if (v.kind === "event") {
      const name = v.signature.replace(/^event\s+/, "").split("(")[0]?.trim() || "Event";
      return { title: `${who}: ${name} on ${net?.name ?? ""}`, lines: ["Fires once per matching log, with decoded arguments", `Contract ${v.address ? short(v.address) : "0x…"}`] };
    }
    const amount = v.minAmount ? `${Number(v.minAmount).toLocaleString("en")}+` : "any amount of";
    const asset = v.assetMode === "native" ? nativeSymbol : v.assetMode === "token" ? "token" : "any asset";
    const verb = v.direction === "out" ? "sent" : v.direction === "any" ? "moved" : "received";
    return {
      title: `${who} ${verb} ${amount} ${asset} on ${net?.name ?? ""}`.replace(/\s+/g, " "),
      lines: [`${v.direction === "out" ? "To" : "From"} 0x4b1e…a90c`, `Watching ${v.address ? (v.address.includes(".") ? v.address : short(v.address)) : "0x…"}`],
    };
  }, [v, net, nativeSymbol]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: MonitorInput =
      v.kind === "transfer"
        ? {
            kind: "transfer",
            name: v.name,
            network: v.network,
            address: v.address,
            direction: v.direction,
            asset: v.assetMode === "token" ? v.token : v.assetMode,
            minAmount: v.minAmount || undefined,
            channelIds: v.channelIds,
          }
        : { kind: "event", name: v.name, network: v.network, address: v.address, signature: v.signature, channelIds: v.channelIds };
    start(async () => {
      if (monitorId) {
        const r = await updateMonitor(monitorId, payload);
        if (!r.ok) return setError(r.error);
        router.push(`/dashboard/monitors/${monitorId}`);
      } else {
        const r = await createMonitor(payload);
        if (!r.ok) return setError(r.error);
        router.push(`/dashboard/monitors/${r.data.id}`);
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">What to watch</h2>
          <Segmented
            label="Monitor type"
            value={v.kind}
            onChange={(k) => set("kind", k)}
            options={[
              { value: "transfer", label: "Wallet transfers", hint: "Coins and tokens moving in or out" },
              { value: "event", label: "Contract event", hint: "Any event a contract emits" },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <label className={field}>
              <span className="font-medium">{v.kind === "event" ? "Contract address" : "Wallet"}</span>
              <input
                className={`${control} font-mono`}
                value={v.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder={v.kind === "event" ? "0x… contract" : "0x… or name.eth"}
                required
                spellCheck={false}
                list="saved-wallets"
              />
              <datalist id="saved-wallets">
                {saved.map((s) => (
                  <option key={s.address} value={s.address}>
                    {s.label}
                  </option>
                ))}
              </datalist>
            </label>
            <label className={field}>
              <span className="font-medium">Network</span>
              <select className={control} value={v.network} onChange={(e) => set("network", e.target.value)}>
                {networks.map((n) => (
                  <option key={n.slug} value={n.slug}>
                    {n.name}
                    {n.testnet ? " (testnet)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {v.kind === "transfer" && saved.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">Saved wallets:</span>
              {saved.slice(0, 6).map((s) => (
                <button
                  key={s.address}
                  type="button"
                  onClick={() => {
                    set("address", s.address);
                    if (!v.name) set("name", s.label);
                  }}
                  className={`rounded-full border px-2.5 py-0.5 ${v.address === s.address ? "border-verdigris text-ink" : "border-line text-muted hover:text-ink"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {v.kind === "transfer" ? (
          <section className="flex flex-col gap-4">
            <h2 className="font-semibold">When to alert</h2>
            <Segmented
              label="Direction"
              value={v.direction}
              onChange={(d) => set("direction", d)}
              options={[
                { value: "in", label: "Incoming" },
                { value: "out", label: "Outgoing" },
                { value: "any", label: "Both" },
              ]}
            />
            <Segmented
              label="Asset"
              value={v.assetMode}
              onChange={(a) => set("assetMode", a)}
              options={[
                { value: "any", label: "Any asset" },
                { value: "native", label: `${nativeSymbol} only` },
                { value: "token", label: "One token" },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {v.assetMode === "token" ? (
                <label className={field}>
                  <span className="font-medium">Token contract</span>
                  <input className={`${control} font-mono`} value={v.token} onChange={(e) => set("token", e.target.value)} placeholder="0x… token address" required spellCheck={false} />
                </label>
              ) : null}
              <label className={field}>
                <span className="font-medium">
                  Minimum amount <span className="font-normal text-muted">(optional)</span>
                </span>
                <input className={`${control} font-mono`} inputMode="decimal" value={v.minAmount} onChange={(e) => set("minAmount", e.target.value)} placeholder="e.g. 10000" />
                <span className="text-xs text-muted">
                  In token units. Leave empty to alert on every transfer.
                  {v.assetMode !== "token" ? " Native transfers include internal ones made by contracts, so busy contracts can match many times per block." : ""}
                </span>
              </label>
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-4">
            <h2 className="font-semibold">Which event</h2>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => set("signature", p.signature)}
                  className={`rounded-full border px-3 py-1 text-xs ${v.signature === p.signature ? "border-verdigris text-ink" : "border-line text-muted hover:text-ink"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className={field}>
              <span className="font-medium">Event signature</span>
              <textarea
                className="min-h-20 rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm focus:border-verdigris focus:outline-none"
                value={v.signature}
                onChange={(e) => set("signature", e.target.value)}
                spellCheck={false}
                required
              />
              <span className="text-xs text-muted">Paste it from the contract source or ABI. Parameter names become the fields in each alert.</span>
            </label>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">Where to send it</h2>
          {channels.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">
              No channels yet. You can save the monitor now and connect Telegram or a webhook from the Monitors page. Alerts are kept in the history either way.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {channels.map((c) => {
                const on = v.channelIds.includes(c.id);
                return (
                  <li key={c.id}>
                    <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${on ? "border-verdigris bg-verdigris-soft/30" : "border-line"}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => set("channelIds", on ? v.channelIds.filter((x) => x !== c.id) : [...v.channelIds, c.id])}
                        className="accent-[var(--verdigris)]"
                      />
                      {c.kind === "telegram" ? <TelegramIcon className="size-5" /> : <WebhookIcon className="size-5 text-muted" />}
                      <span className="text-sm">{c.name}</span>
                      <span className="ml-auto text-xs text-muted capitalize">{c.kind}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <label className={field}>
          <span className="font-medium">Monitor name</span>
          <input className={control} value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Treasury" required minLength={2} maxLength={60} />
        </label>

        <FormError message={error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : monitorId ? "Save changes" : "Create monitor"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-10" aria-label="Preview">
        <span className="text-sm font-medium">Preview</span>
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-5">
          <span className="flex items-center gap-2 text-xs text-muted">
            <TelegramIcon className="size-4" /> How the alert reads in Telegram
          </span>
          <div className="flex items-end gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-paper" aria-hidden>
              S
            </span>
            <div className="min-w-0 rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3 text-sm">
              <p className="font-semibold">{preview.title}</p>
              {preview.lines.map((l) => (
                <p key={l} className="mt-1 text-muted">
                  {l}
                </p>
              ))}
              <p className="mt-2 text-xs text-verdigris">View transaction · Watched address</p>
            </div>
          </div>
          <p className="text-xs text-muted">
            Checked every 30 seconds starting from the next block. Each match alerts once. If a scan finds more than 25, you get the first 5 and a summary, and a monitor that sends over 200 alerts in an hour pauses itself.
          </p>
        </div>
      </aside>
    </form>
  );
}

function short(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
