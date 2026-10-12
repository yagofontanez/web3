"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@w3s/db";
import { PLANS, stripe, stripeConfigured, type PlanId } from "@w3s/billing";
import { audit } from "@/lib/audit";
import { requireOrg } from "@/lib/dal";
import { getSubscription } from "@/lib/billing";

type Result<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

const APP_URL = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function ensureCustomer(org: { id: string; name: string }, email: string) {
  const existing = await getSubscription(org.id);
  if (existing) return existing.stripeCustomerId;
  const customer = await stripe().customers.create({ name: org.name, email, metadata: { organizationId: org.id } }, { idempotencyKey: `customer-${org.id}` });
  await db.insert(schema.subscription).values({ organizationId: org.id, stripeCustomerId: customer.id, plan: "free", status: "incomplete" }).onConflictDoNothing();
  return customer.id;
}

async function portalConfiguration() {
  const configs = await stripe().billingPortal.configurations.list({ limit: 20 });
  return configs.data.find((c) => c.metadata?.app === "systema" && c.active)?.id;
}

export async function startCheckout(planId: PlanId): Promise<Result<{ url: string }>> {
  const { org, user, can } = await requireOrg();
  if (!can({ billing: ["update"] })) return { ok: false, error: "Only the owner can change the plan." };
  if (!stripeConfigured()) return { ok: false, error: "Billing isn't configured on this server." };
  const plan = PLANS[planId];
  if (!plan?.lookupKey) return { ok: false, error: "That plan can't be purchased." };

  const sub = await getSubscription(org.id);
  if (sub?.stripeSubscriptionId && ["active", "trialing", "past_due"].includes(sub.status)) {
    return openPortal("update");
  }

  const customer = await ensureCustomer(org, user.email);
  const [price] = (await stripe().prices.list({ lookup_keys: [plan.lookupKey], active: true, limit: 1 })).data;
  if (!price) return { ok: false, error: "That plan isn't set up in Stripe yet. Run pnpm --filter @w3s/billing setup-stripe." };

  const suffix = Array.from(randomBytes(8), (b) => String.fromCharCode(97 + (b % 26))).join("");
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: org.id,
    line_items: [{ price: price.id, quantity: 1 }],
    subscription_data: { metadata: { organizationId: org.id, plan: plan.id } },
    metadata: { organizationId: org.id },
    allow_promotion_codes: true,
    locale: "en",
    branding_settings: {
      display_name: "Systema",
      background_color: "#f4f6f8",
      button_color: "#18202c",
      border_style: "rounded",
      font_family: "source_sans_pro",
    },
    customer_update: { name: "auto", address: "auto" },
    success_url: `${APP_URL}/dashboard/settings?tab=billing&checkout=success`,
    cancel_url: `${APP_URL}/dashboard/settings?tab=billing&checkout=canceled`,
    ...({ integration_identifier: `systema-plans-${suffix}` } as object),
  });
  await audit({ organizationId: org.id, actorId: user.id, action: "billing.checkout_started", metadata: { plan: plan.id } });
  return { ok: true, data: { url: session.url! } };
}

export async function openPortal(flow?: "update" | "cancel"): Promise<Result<{ url: string }>> {
  const { org, can } = await requireOrg();
  if (!can({ billing: ["update"] })) return { ok: false, error: "Only the owner can manage billing." };
  const sub = await getSubscription(org.id);
  if (!sub) return { ok: false, error: "There's no billing account yet. Pick a plan first." };
  const configuration = await portalConfiguration();
  const session = await stripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${APP_URL}/dashboard/settings?tab=billing`,
    ...(configuration ? { configuration } : {}),
    ...(flow === "update" && sub.stripeSubscriptionId
      ? { flow_data: { type: "subscription_update" as const, subscription_update: { subscription: sub.stripeSubscriptionId } } }
      : {}),
    ...(flow === "cancel" && sub.stripeSubscriptionId
      ? { flow_data: { type: "subscription_cancel" as const, subscription_cancel: { subscription: sub.stripeSubscriptionId } } }
      : {}),
  });
  return { ok: true, data: { url: session.url } };
}

export async function planSnapshot(): Promise<Result<{ plan: string; status: string | null }>> {
  const { org } = await requireOrg();
  const [row] = await db.select({ plan: schema.subscription.plan, status: schema.subscription.status }).from(schema.subscription).where(eq(schema.subscription.organizationId, org.id)).limit(1);
  return { ok: true, data: { plan: row?.plan ?? "free", status: row?.status ?? null } };
}
