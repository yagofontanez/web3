import { PAID_PLANS } from "../src/plans";
import { stripe } from "../src/stripe";

const s = stripe();
for (const plan of PAID_PLANS) {
  const existing = await s.prices.list({ lookup_keys: [plan.lookupKey!], expand: ["data.product"], limit: 1 });
  const price = existing.data[0];
  if (price && price.unit_amount === plan.priceUsd * 100 && price.active) {
    console.log(`${plan.name}: already set up (${price.id})`);
    continue;
  }
  const product = await s.products.create({
    name: `Systema ${plan.name}`,
    description: plan.tagline,
    metadata: { plan: plan.id },
  });
  const created = await s.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: plan.priceUsd * 100,
    recurring: { interval: "month" },
    lookup_key: plan.lookupKey!,
    transfer_lookup_key: true,
    metadata: { plan: plan.id },
  });
  console.log(`${plan.name}: created ${created.id} at $${plan.priceUsd}/month`);
}

const prices = await s.prices.list({ lookup_keys: PAID_PLANS.map((p) => p.lookupKey!), active: true, limit: 10 });
const products = [...new Set(prices.data.map((p) => (typeof p.product === "string" ? p.product : p.product.id)))].map((product) => ({
  product,
  prices: prices.data.filter((p) => (typeof p.product === "string" ? p.product : p.product.id) === product).map((p) => p.id),
}));
const configs = await s.billingPortal.configurations.list({ limit: 20 });
const existingPortal = configs.data.find((c) => c.metadata?.app === "systema" && c.active);
const portalSettings = {
  business_profile: { headline: "Manage your Systema plan" },
  features: {
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] as ("email" | "address" | "tax_id")[] },
    subscription_cancel: { enabled: true, mode: "at_period_end" as const },
    subscription_update: { enabled: true, default_allowed_updates: ["price" as const], products, proration_behavior: "create_prorations" as const },
  },
  metadata: { app: "systema" },
};
if (existingPortal) {
  await s.billingPortal.configurations.update(existingPortal.id, portalSettings);
  console.log(`Customer portal: updated (${existingPortal.id})`);
} else {
  const created = await s.billingPortal.configurations.create(portalSettings);
  console.log(`Customer portal: created (${created.id})`);
}
