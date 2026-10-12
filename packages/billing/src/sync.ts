import type Stripe from "stripe";
import { planByLookupKey, type PlanId, type SubscriptionStatus } from "./plans";

export type SubscriptionSnapshot = {
  organizationId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  priceId: string | null;
};

export const SYNC_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
]);

export function subscriptionIdFromEvent(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as Record<string, unknown>;
  if (event.type.startsWith("customer.subscription.")) return (obj.id as string) ?? null;
  if (event.type === "checkout.session.completed") return typeof obj.subscription === "string" ? obj.subscription : ((obj.subscription as { id?: string })?.id ?? null);
  if (event.type.startsWith("invoice.")) {
    const parent = obj.parent as { subscription_details?: { subscription?: string | { id: string } } } | undefined;
    const sub = parent?.subscription_details?.subscription ?? (obj.subscription as string | { id: string } | undefined);
    return typeof sub === "string" ? sub : (sub?.id ?? null);
  }
  return null;
}

export function snapshot(sub: Stripe.Subscription): SubscriptionSnapshot | { error: string } {
  const organizationId = sub.metadata?.organizationId;
  if (!organizationId) return { error: "Subscription has no organizationId metadata" };
  const item = sub.items.data[0];
  const plan = planByLookupKey(item?.price.lookup_key);
  if (!plan) return { error: `Unknown price lookup key ${item?.price.lookup_key}` };
  const periodEnd = (item as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  return {
    organizationId,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    plan,
    status: sub.status as SubscriptionStatus,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    priceId: item?.price.id ?? null,
  };
}
