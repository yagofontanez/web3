import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@w3s/db";
import { effectivePlan, snapshot, stripe, subscriptionIdFromEvent, SYNC_EVENTS, type Stripe } from "@w3s/billing";
import { audit } from "@/lib/audit";
import { enforceMonitorLimit, invalidatePlanCache } from "@/lib/billing";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "not configured" }, { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const [seen] = await db.select({ id: schema.stripeEvent.id }).from(schema.stripeEvent).where(eq(schema.stripeEvent.id, event.id)).limit(1);
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  if (SYNC_EVENTS.has(event.type)) {
    const subscriptionId = subscriptionIdFromEvent(event);
    if (subscriptionId) {
      const sub = await stripe().subscriptions.retrieve(subscriptionId);
      const snap = snapshot(sub);
      if ("error" in snap) {
        console.error(`[stripe] ${event.id} ${event.type}: ${snap.error}`);
      } else {
        const values = {
          stripeCustomerId: snap.stripeCustomerId,
          stripeSubscriptionId: snap.stripeSubscriptionId,
          plan: snap.plan,
          status: snap.status,
          priceId: snap.priceId,
          currentPeriodEnd: snap.currentPeriodEnd,
          cancelAtPeriodEnd: snap.cancelAtPeriodEnd,
          updatedAt: new Date(),
        };
        const before = await db.transaction(async (tx) => {
          const [row] = await tx.select().from(schema.subscription).where(eq(schema.subscription.organizationId, snap.organizationId)).for("update").limit(1);
          await tx
            .insert(schema.subscription)
            .values({ organizationId: snap.organizationId, ...values })
            .onConflictDoUpdate({ target: schema.subscription.organizationId, set: values });
          return row;
        });
        await invalidatePlanCache(snap.organizationId);
        const now = effectivePlan(snap);
        const was = effectivePlan(before ?? null);
        if (now.id !== was.id || before?.status !== snap.status || before?.cancelAtPeriodEnd !== snap.cancelAtPeriodEnd) {
          await audit({
            organizationId: snap.organizationId,
            action: "billing.subscription_changed",
            targetType: "subscription",
            targetId: snap.stripeSubscriptionId,
            metadata: { from: was.id, to: now.id, status: snap.status, cancelAtPeriodEnd: snap.cancelAtPeriodEnd },
          });
        }
        if (now.limits.monitors < was.limits.monitors) await enforceMonitorLimit(snap.organizationId, now);
      }
    }
  }

  await db.insert(schema.stripeEvent).values({ id: event.id, type: event.type }).onConflictDoNothing();
  return NextResponse.json({ received: true });
}
