import { eq, sql as dsql } from "drizzle-orm";
import type { Redis } from "ioredis";
import { db, schema } from "@w3s/db";
import { getActivity, getNfts, getPortfolio, resolveQuery } from "@w3s/explorer";
import type { ApiKeyRecord, ExplorerService, KeyStore, LogSink, RequestLogEntry } from "./types";

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
