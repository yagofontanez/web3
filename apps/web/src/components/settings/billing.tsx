"use client";

import { useEffect, useState } from "react";
import type { PlanId } from "@w3s/billing/plans";
import { openPortal, planSnapshot, startCheckout } from "@/app/(app)/dashboard/settings/billing/actions";
import { reloadTo } from "@/lib/navigation";
import { Button, FormError } from "../ui";

type Action = { kind: "checkout"; plan: PlanId } | { kind: "portal"; flow?: "update" | "cancel" };

export function BillingButton({ action, children, variant = "primary", className }: { action: Action; children: React.ReactNode; variant?: "primary" | "secondary"; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = action.kind === "checkout" ? await startCheckout(action.plan) : await openPortal(action.flow);
      if (!res.ok) {
        setBusy(false);
        return setError(res.error);
      }
      window.location.assign(res.data.url);
    } catch {
      setBusy(false);
      setError("Stripe didn't respond. Try again in a moment.");
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Button type="button" variant={variant} onClick={go} disabled={busy} className="w-full">
        {busy ? "Opening Stripe…" : children}
      </Button>
      <FormError message={error} />
    </div>
  );
}

export function CheckoutWatcher() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let stopped = false;
    const started = Date.now();
    async function tick() {
      if (stopped) return;
      const res = await planSnapshot().catch(() => null);
      if (res?.ok && res.data.plan !== "free" && (res.data.status === "active" || res.data.status === "trialing")) {
        return reloadTo("/dashboard/settings?tab=billing");
      }
      if (Date.now() - started > 45_000) return setTimedOut(true);
      setTimeout(tick, 1500);
    }
    void tick();
    return () => {
      stopped = true;
    };
  }, []);

  return (
    <div role="status" className="flex items-center gap-3 rounded-xl border border-verdigris/30 bg-verdigris-soft/60 px-4 py-3 text-sm">
      {timedOut ? (
        <span>
          Payment received. Stripe is still confirming the subscription, so the plan will switch over shortly.{" "}
          <button type="button" onClick={() => reloadTo("/dashboard/settings?tab=billing")} className="font-medium underline">
            Check again
          </button>
        </span>
      ) : (
        <>
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-verdigris" />
          <span>Payment received. Activating your new plan…</span>
        </>
      )}
    </div>
  );
}
