export type PlanId = "free" | "pro" | "team";

export type Plan = {
  id: PlanId;
  name: string;
  priceUsd: number;
  lookupKey: string | null;
  tagline: string;
  limits: { apiRequestsPerMonth: number; monitors: number; members: number; webhooks: boolean };
  highlights: string[];
};

export const UNLIMITED = Number.POSITIVE_INFINITY;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    lookupKey: null,
    tagline: "For trying things out",
    limits: { apiRequestsPerMonth: 10_000, monitors: 3, members: 3, webhooks: false },
    highlights: ["10,000 API requests a month", "3 active monitors", "Telegram alerts", "Up to 3 teammates"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 29,
    lookupKey: "w3s_pro_monthly",
    tagline: "For a product in production",
    limits: { apiRequestsPerMonth: 500_000, monitors: 25, members: 10, webhooks: true },
    highlights: ["500,000 API requests a month", "25 active monitors", "Signed webhooks", "Up to 10 teammates"],
  },
  team: {
    id: "team",
    name: "Team",
    priceUsd: 99,
    lookupKey: "w3s_team_monthly",
    tagline: "For teams running on-chain operations",
    limits: { apiRequestsPerMonth: 5_000_000, monitors: UNLIMITED, members: UNLIMITED, webhooks: true },
    highlights: ["5,000,000 API requests a month", "Unlimited monitors", "Signed webhooks", "Unlimited teammates"],
  },
};

export const PAID_PLANS = [PLANS.pro, PLANS.team];

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "unpaid" | "canceled" | "incomplete" | "incomplete_expired" | "paused";

export function effectivePlan(sub: { plan: PlanId; status: SubscriptionStatus } | null | undefined): Plan {
  if (!sub) return PLANS.free;
  return sub.status === "active" || sub.status === "trialing" || sub.status === "past_due" ? PLANS[sub.plan] : PLANS.free;
}

export function planByLookupKey(key: string | null | undefined): PlanId | null {
  return (Object.values(PLANS).find((p) => p.lookupKey && p.lookupKey === key)?.id as PlanId | undefined) ?? null;
}

export function usagePeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatLimit(n: number) {
  return n === UNLIMITED ? "Unlimited" : n.toLocaleString("en");
}
