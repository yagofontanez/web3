import "server-only";
import { and, count, eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@w3s/db";
import { effectivePlan, usagePeriod, type Plan } from "@w3s/billing";
import { redis } from "./redis";

export const getSubscription = cache(async (organizationId: string) => {
  const [row] = await db.select().from(schema.subscription).where(eq(schema.subscription.organizationId, organizationId)).limit(1);
  return row ?? null;
});

export const getPlan = cache(async (organizationId: string): Promise<Plan> => effectivePlan(await getSubscription(organizationId)));

export async function monthlyApiUsage(organizationId: string) {
  try {
    return Number((await redis().get(`w3s:usage:${organizationId}:${usagePeriod()}`)) ?? 0);
  } catch {
    return 0;
  }
}

export async function activeMonitorCount(organizationId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(schema.monitor)
    .where(and(eq(schema.monitor.organizationId, organizationId), eq(schema.monitor.enabled, true)));
  return r?.n ?? 0;
}

export async function seatCount(organizationId: string) {
  const [members] = await db.select({ n: count() }).from(schema.member).where(eq(schema.member.organizationId, organizationId));
  const [invites] = await db
    .select({ n: count() })
    .from(schema.invitation)
    .where(and(eq(schema.invitation.organizationId, organizationId), eq(schema.invitation.status, "pending")));
  return (members?.n ?? 0) + (invites?.n ?? 0);
}

export async function invalidatePlanCache(organizationId: string) {
  await redis().del(`w3s:plan:${organizationId}`).catch(() => 0);
}

export async function enforceMonitorLimit(organizationId: string, plan: Plan) {
  if (!Number.isFinite(plan.limits.monitors)) return 0;
  const active = await db
    .select({ id: schema.monitor.id })
    .from(schema.monitor)
    .where(and(eq(schema.monitor.organizationId, organizationId), eq(schema.monitor.enabled, true)))
    .orderBy(schema.monitor.createdAt);
  const excess = active.slice(plan.limits.monitors);
  for (const m of excess) {
    await db
      .update(schema.monitor)
      .set({ enabled: false, lastError: `Paused because the ${plan.name} plan includes ${plan.limits.monitors} active monitors.` })
      .where(eq(schema.monitor.id, m.id));
  }
  return excess.length;
}
