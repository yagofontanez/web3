import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { effectivePlan, PLANS, planByLookupKey, usagePeriod } from "./plans";
import { snapshot, subscriptionIdFromEvent } from "./sync";

const sub = (over: Partial<Stripe.Subscription> = {}, lookup = "w3s_pro_monthly") =>
  ({
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    metadata: { organizationId: "org_1" },
    items: { data: [{ current_period_end: 1_800_000_000, price: { id: "price_1", lookup_key: lookup } }] },
    ...over,
  }) as unknown as Stripe.Subscription;

describe("plans", () => {
  it("only grants paid limits while the subscription is in good standing", () => {
    expect(effectivePlan(null).id).toBe("free");
    expect(effectivePlan({ plan: "pro", status: "active" }).id).toBe("pro");
    expect(effectivePlan({ plan: "team", status: "past_due" }).id).toBe("team");
    expect(effectivePlan({ plan: "pro", status: "canceled" }).id).toBe("free");
    expect(effectivePlan({ plan: "pro", status: "incomplete" }).id).toBe("free");
  });

  it("maps lookup keys and usage periods", () => {
    expect(planByLookupKey("w3s_team_monthly")).toBe("team");
    expect(planByLookupKey("something_else")).toBeNull();
    expect(usagePeriod(new Date(Date.UTC(2026, 0, 31, 23, 59)))).toBe("2026-01");
    expect(PLANS.free.limits.webhooks).toBe(false);
  });
});

describe("subscription sync", () => {
  it("builds a snapshot with the period end from the subscription item", () => {
    const s = snapshot(sub());
    expect(s).toMatchObject({ organizationId: "org_1", plan: "pro", status: "active", stripeCustomerId: "cus_1", cancelAtPeriodEnd: false });
    expect("currentPeriodEnd" in s && s.currentPeriodEnd?.toISOString()).toBe(new Date(1_800_000_000_000).toISOString());
  });

  it("refuses subscriptions it can't attribute or price", () => {
    expect(snapshot(sub({ metadata: {} }))).toHaveProperty("error");
    expect(snapshot(sub({}, "unknown_price"))).toHaveProperty("error");
  });

  it("marks scheduled cancellations", () => {
    expect(snapshot(sub({ cancel_at_period_end: true }))).toMatchObject({ cancelAtPeriodEnd: true });
  });

  it("finds the subscription id on every event type it syncs", () => {
    const ev = (type: string, object: unknown) => ({ type, data: { object } }) as unknown as Stripe.Event;
    expect(subscriptionIdFromEvent(ev("customer.subscription.updated", { id: "sub_9" }))).toBe("sub_9");
    expect(subscriptionIdFromEvent(ev("checkout.session.completed", { subscription: "sub_8" }))).toBe("sub_8");
    expect(subscriptionIdFromEvent(ev("invoice.paid", { parent: { subscription_details: { subscription: "sub_7" } } }))).toBe("sub_7");
    expect(subscriptionIdFromEvent(ev("invoice.paid", { subscription: { id: "sub_6" } }))).toBe("sub_6");
    expect(subscriptionIdFromEvent(ev("invoice.paid", {}))).toBeNull();
  });
});
