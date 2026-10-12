import { eq, sql as dsql } from "drizzle-orm";
import type { Redis } from "ioredis";
import { effectivePlan, PLANS, usagePeriod, type PlanId } from "@w3s/billing/plans";
import { db, schema } from "@w3s/db";
import { getActivity, getNfts, getPortfolio, resolveQuery } from "@w3s/explorer";
import type { ApiKeyRecord, ExplorerService, KeyStore, LogSink, QuotaStore, RequestLogEntry } from "./types";

const KEY_TTL = 60;

export function dbKeyStore(redis: Redis): KeyStore {
  return {
    async findByHash(hash) {
      const cacheKey = `w3s:apikey:${hash}`;
      try {
        const hit = await redis.get(cacheKey);
        if (hit) return hit === "null" ? null : (JSON.parse(hit) as ApiKeyRecord);
      } catch {}
      const [row] = await db
        .select({
          id: schema.apiKey.id,
          organizationId: schema.apiKey.organizationId,
          projectId: schema.apiKey.projectId,
          rateLimitPerMinute: schema.apiKey.rateLimitPerMinute,
          revokedAt: schema.apiKey.revokedAt,
          archivedAt: schema.project.archivedAt,
        })
        .from(schema.apiKey)
        .innerJoin(schema.project, eq(schema.apiKey.projectId, schema.project.id))
        .where(eq(schema.apiKey.hash, hash))
        .limit(1);
      const record: ApiKeyRecord | null = row
        ? {
            id: row.id,
            organizationId: row.organizationId,
            projectId: row.projectId,
            rateLimitPerMinute: row.rateLimitPerMinute,
            revoked: row.revokedAt !== null || row.archivedAt !== null,
          }
        : null;
      try {
        await redis.set(cacheKey, JSON.stringify(record), "EX", record ? KEY_TTL : 30);
      } catch {}
      return record;
    },
  };
}

const PLAN_TTL = 60;

export function redisQuotaStore(redis: Redis): QuotaStore {
  async function planFor(organizationId: string) {
    const cacheKey = `w3s:plan:${organizationId}`;
    try {
      const hit = await redis.get(cacheKey);
      if (hit && hit in PLANS) return PLANS[hit as PlanId];
    } catch {}
    const [row] = await db
      .select({ plan: schema.subscription.plan, status: schema.subscription.status })
      .from(schema.subscription)
      .where(eq(schema.subscription.organizationId, organizationId))
      .limit(1);
    const plan = effectivePlan(row ?? null);
    try {
      await redis.set(cacheKey, plan.id, "EX", PLAN_TTL);
    } catch {}
    return plan;
  }

  return {
    async consume(organizationId) {
      try {
        const plan = await planFor(organizationId);
        const now = new Date();
        const key = `w3s:usage:${organizationId}:${usagePeriod(now)}`;
        const used = await redis.incr(key);
        if (used === 1) await redis.expire(key, 60 * 60 * 24 * 40);
        const limit = plan.limits.apiRequestsPerMonth;
        if (Number.isFinite(limit) && used > limit) await redis.decr(key);
        return { used, limit, plan: plan.name, resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
      } catch {
        return null;
      }
    },
  };
}

export const liveExplorer: ExplorerService = {
  resolve: resolveQuery,
  portfolio: getPortfolio,
  nfts: getNfts,
  activity: getActivity,
};

export function batchedLogSink({ flushEveryMs = 2000, maxBatch = 500 } = {}): LogSink & { flush(): Promise<void>; stop(): Promise<void> } {
  let buffer: RequestLogEntry[] = [];
  let flushing: Promise<void> | null = null;

  async function flush() {
    if (flushing) await flushing;
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    flushing = (async () => {
      try {
        await db.insert(schema.apiRequestLog).values(batch);
        const lastUsed = new Map<string, Date>();
        for (const e of batch) {
          const prev = lastUsed.get(e.apiKeyId);
          if (!prev || prev < e.createdAt) lastUsed.set(e.apiKeyId, e.createdAt);
        }
        await Promise.all(
          [...lastUsed].map(([id, at]) =>
            db
              .update(schema.apiKey)
              .set({ lastUsedAt: dsql`greatest(coalesce(${schema.apiKey.lastUsedAt}, ${at.toISOString()}::timestamp), ${at.toISOString()}::timestamp)` })
              .where(eq(schema.apiKey.id, id)),
          ),
        );
      } catch (err) {
        console.error("[api] failed to write request logs", err);
      } finally {
        flushing = null;
      }
    })();
    await flushing;
  }

  const timer = setInterval(() => void flush(), flushEveryMs);
  timer.unref();

  return {
    push(entry) {
      buffer.push(entry);
      if (buffer.length >= maxBatch) void flush();
    },
    flush,
    async stop() {
      clearInterval(timer);
      await flush();
    },
  };
}
