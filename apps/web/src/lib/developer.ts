import "server-only";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db, schema } from "@w3s/db";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100").replace(/\/$/, "");

const log = schema.apiRequestLog;
const since = (days: number) => sql`now() - make_interval(days => ${days})`;

export async function listProjects(organizationId: string) {
  const projects = await db
    .select({
      id: schema.project.id,
      name: schema.project.name,
      description: schema.project.description,
      createdAt: schema.project.createdAt,
    })
    .from(schema.project)
    .where(and(eq(schema.project.organizationId, organizationId), isNull(schema.project.archivedAt)))
    .orderBy(desc(schema.project.createdAt));
  if (projects.length === 0) return [];

  const [keys, usage] = await Promise.all([
    db
      .select({ projectId: schema.apiKey.projectId, active: count() })
      .from(schema.apiKey)
      .where(and(eq(schema.apiKey.organizationId, organizationId), isNull(schema.apiKey.revokedAt)))
      .groupBy(schema.apiKey.projectId),
    db
      .select({
        projectId: log.projectId,
        requests: count(),
        errors: sql<number>`count(*) filter (where ${log.status} >= 400)`.mapWith(Number),
        lastAt: sql<Date | null>`max(${log.createdAt})`,
      })
      .from(log)
      .where(and(eq(log.organizationId, organizationId), gte(log.createdAt, since(7))))
      .groupBy(log.projectId),
  ]);
  const daily = await db
    .select({
      projectId: log.projectId,
      day: sql<string>`to_char(date_trunc('day', ${log.createdAt}), 'YYYY-MM-DD')`,
      requests: count(),
    })
    .from(log)
    .where(and(eq(log.organizationId, organizationId), gte(log.createdAt, since(14))))
    .groupBy(log.projectId, sql`2`);
  const days = lastDays(14);
  return projects.map((p) => ({
    ...p,
    series: days.map((d) => daily.find((r) => r.projectId === p.id && r.day === d)?.requests ?? 0),
    activeKeys: keys.find((k) => k.projectId === p.id)?.active ?? 0,
    requests7d: usage.find((u) => u.projectId === p.id)?.requests ?? 0,
    errors7d: usage.find((u) => u.projectId === p.id)?.errors ?? 0,
    lastRequestAt: usage.find((u) => u.projectId === p.id)?.lastAt ?? null,
  }));
}

function lastDays(n: number) {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (n - 1 - i)));
    return d.toISOString().slice(0, 10);
  });
}

export async function getProject(organizationId: string, projectId: string) {
  const [p] = await db
    .select()
    .from(schema.project)
    .where(and(eq(schema.project.id, projectId), eq(schema.project.organizationId, organizationId), isNull(schema.project.archivedAt)))
    .limit(1);
  return p ?? null;
}

export async function listKeys(projectId: string) {
  const usage = await db
    .select({ apiKeyId: log.apiKeyId, requests: count() })
    .from(log)
    .where(and(eq(log.projectId, projectId), gte(log.createdAt, since(1))))
    .groupBy(log.apiKeyId);
  const keys = await db
    .select({
      id: schema.apiKey.id,
      name: schema.apiKey.name,
      prefix: schema.apiKey.prefix,
      rateLimitPerMinute: schema.apiKey.rateLimitPerMinute,
      createdAt: schema.apiKey.createdAt,
      lastUsedAt: schema.apiKey.lastUsedAt,
      revokedAt: schema.apiKey.revokedAt,
      createdBy: schema.user.name,
    })
    .from(schema.apiKey)
    .leftJoin(schema.user, eq(schema.apiKey.createdBy, schema.user.id))
    .where(eq(schema.apiKey.projectId, projectId))
    .orderBy(sql`${schema.apiKey.revokedAt} is not null`, desc(schema.apiKey.createdAt));
  return keys.map((k) => ({ ...k, requests24h: usage.find((u) => u.apiKeyId === k.id)?.requests ?? 0 }));
}

export type Scope = { organizationId: string; projectId?: string };

const scopeWhere = (s: Scope, days: number) =>
  and(eq(log.organizationId, s.organizationId), s.projectId ? eq(log.projectId, s.projectId) : undefined, gte(log.createdAt, since(days)));

export async function usageSummary(scope: Scope, days = 1) {
  const [row] = await db
    .select({
      requests: count(),
      errors: sql<number>`count(*) filter (where ${log.status} >= 400)`.mapWith(Number),
      serverErrors: sql<number>`count(*) filter (where ${log.status} >= 500)`.mapWith(Number),
      p50: sql<number | null>`percentile_cont(0.5) within group (order by ${log.durationMs})`.mapWith((v) => (v === null ? null : Number(v))),
      p95: sql<number | null>`percentile_cont(0.95) within group (order by ${log.durationMs})`.mapWith((v) => (v === null ? null : Number(v))),
    })
    .from(log)
    .where(scopeWhere(scope, days));
  return row ?? { requests: 0, errors: 0, serverErrors: 0, p50: null, p95: null };
}

export async function dailyUsage(scope: Scope, days = 14) {
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${log.createdAt}), 'YYYY-MM-DD')`,
      requests: count(),
      errors: sql<number>`count(*) filter (where ${log.status} >= 400)`.mapWith(Number),
    })
    .from(log)
    .where(scopeWhere(scope, days))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return lastDays(days).map((key) => ({ day: key, requests: byDay.get(key)?.requests ?? 0, errors: byDay.get(key)?.errors ?? 0 }));
}

export async function topRoutes(scope: Scope, days = 7) {
  return db
    .select({
      route: log.route,
      requests: count(),
      errors: sql<number>`count(*) filter (where ${log.status} >= 400)`.mapWith(Number),
      p95: sql<number>`percentile_cont(0.95) within group (order by ${log.durationMs})`.mapWith(Number),
    })
    .from(log)
    .where(scopeWhere(scope, days))
    .groupBy(log.route)
    .orderBy(desc(count()))
    .limit(8);
}

export async function statusBreakdown(scope: Scope, days = 7) {
  const [row] = await db
    .select({
      ok: sql<number>`count(*) filter (where ${log.status} < 400)`.mapWith(Number),
      client: sql<number>`count(*) filter (where ${log.status} >= 400 and ${log.status} < 500)`.mapWith(Number),
      server: sql<number>`count(*) filter (where ${log.status} >= 500)`.mapWith(Number),
    })
    .from(log)
    .where(scopeWhere(scope, days));
  return row ?? { ok: 0, client: 0, server: 0 };
}

export async function topErrors(scope: Scope, days = 7) {
  return db
    .select({ code: log.errorCode, status: log.status, requests: count(), lastAt: sql<Date>`max(${log.createdAt})` })
    .from(log)
    .where(and(scopeWhere(scope, days), gte(log.status, 400)))
    .groupBy(log.errorCode, log.status)
    .orderBy(desc(count()))
    .limit(6);
}

export type LogFilter = "all" | "2xx" | "4xx" | "5xx";

export async function recentRequests(scope: Scope, filter: LogFilter = "all", limit = 100) {
  return db
    .select({
      id: log.id,
      method: log.method,
      path: log.path,
      status: log.status,
      durationMs: log.durationMs,
      errorCode: log.errorCode,
      createdAt: log.createdAt,
      keyName: schema.apiKey.name,
      keyPrefix: schema.apiKey.prefix,
      ip: log.ip,
      route: log.route,
    })
    .from(log)
    .leftJoin(schema.apiKey, eq(log.apiKeyId, schema.apiKey.id))
    .where(
      and(
        scopeWhere(scope, 30),
        filter === "2xx" ? sql`${log.status} < 400` : undefined,
        filter === "4xx" ? sql`${log.status} >= 400 and ${log.status} < 500` : undefined,
        filter === "5xx" ? gte(log.status, 500) : undefined,
      ),
    )
    .orderBy(desc(log.createdAt))
    .limit(limit);
}
