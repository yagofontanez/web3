import "server-only";
import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@w3s/db";

const since = (hours: number) => sql`now() - make_interval(hours => ${hours})`;

export async function listChannels(organizationId: string) {
  const channels = await db
    .select()
    .from(schema.notificationChannel)
    .where(and(eq(schema.notificationChannel.organizationId, organizationId), isNull(schema.notificationChannel.disabledAt)))
    .orderBy(desc(schema.notificationChannel.createdAt));
  if (channels.length === 0) return [];
  const stats = await db
    .select({
      channelId: schema.delivery.channelId,
      delivered: sql<number>`count(*) filter (where ${schema.delivery.status} = 'delivered')`.mapWith(Number),
      failed: sql<number>`count(*) filter (where ${schema.delivery.status} = 'failed')`.mapWith(Number),
      lastAt: sql<Date | null>`max(${schema.delivery.lastAttemptAt})`,
    })
    .from(schema.delivery)
    .where(and(inArray(schema.delivery.channelId, channels.map((c) => c.id)), gte(schema.delivery.createdAt, since(24 * 7))))
    .groupBy(schema.delivery.channelId);
  return channels.map((c) => ({ ...c, stats: stats.find((s) => s.channelId === c.id) ?? { delivered: 0, failed: 0, lastAt: null } }));
}

export async function listMonitors(organizationId: string) {
  const monitors = await db
    .select()
    .from(schema.monitor)
    .where(eq(schema.monitor.organizationId, organizationId))
    .orderBy(desc(schema.monitor.enabled), desc(schema.monitor.createdAt));
  if (monitors.length === 0) return [];
  const ids = monitors.map((m) => m.id);
  const [links, alerts] = await Promise.all([
    db
      .select({ monitorId: schema.monitorChannel.monitorId, channelId: schema.monitorChannel.channelId, kind: schema.notificationChannel.kind, name: schema.notificationChannel.name })
      .from(schema.monitorChannel)
      .innerJoin(schema.notificationChannel, eq(schema.monitorChannel.channelId, schema.notificationChannel.id))
      .where(and(inArray(schema.monitorChannel.monitorId, ids), isNull(schema.notificationChannel.disabledAt))),
    db
      .select({ monitorId: schema.alert.monitorId, total: count() })
      .from(schema.alert)
      .where(and(inArray(schema.alert.monitorId, ids), gte(schema.alert.createdAt, since(24)), eq(schema.alert.test, false)))
      .groupBy(schema.alert.monitorId),
  ]);
  return monitors.map((m) => ({
    ...m,
    channels: links.filter((l) => l.monitorId === m.id),
    alerts24h: alerts.find((a) => a.monitorId === m.id)?.total ?? 0,
  }));
}

export async function getMonitor(organizationId: string, id: string) {
  const [m] = await db.select().from(schema.monitor).where(and(eq(schema.monitor.id, id), eq(schema.monitor.organizationId, organizationId))).limit(1);
  if (!m) return null;
  const channels = await db
    .select({ channelId: schema.monitorChannel.channelId })
    .from(schema.monitorChannel)
    .where(eq(schema.monitorChannel.monitorId, id));
  return { ...m, channelIds: channels.map((c) => c.channelId) };
}

export async function recentAlerts(organizationId: string, opts: { monitorId?: string; limit?: number } = {}) {
  const alerts = await db
    .select({
      id: schema.alert.id,
      title: schema.alert.title,
      payload: schema.alert.payload,
      test: schema.alert.test,
      createdAt: schema.alert.createdAt,
      monitorId: schema.alert.monitorId,
      monitorName: schema.monitor.name,
    })
    .from(schema.alert)
    .innerJoin(schema.monitor, eq(schema.alert.monitorId, schema.monitor.id))
    .where(and(eq(schema.alert.organizationId, organizationId), opts.monitorId ? eq(schema.alert.monitorId, opts.monitorId) : undefined))
    .orderBy(desc(schema.alert.createdAt))
    .limit(opts.limit ?? 20);
  if (alerts.length === 0) return [];
  const deliveries = await db
    .select({
      alertId: schema.delivery.alertId,
      status: schema.delivery.status,
      attempts: schema.delivery.attempts,
      lastError: schema.delivery.lastError,
      lastStatusCode: schema.delivery.lastStatusCode,
      channelName: schema.notificationChannel.name,
      channelKind: schema.notificationChannel.kind,
    })
    .from(schema.delivery)
    .innerJoin(schema.notificationChannel, eq(schema.delivery.channelId, schema.notificationChannel.id))
    .where(inArray(schema.delivery.alertId, alerts.map((a) => a.id)));
  return alerts.map((a) => ({ ...a, deliveries: deliveries.filter((d) => d.alertId === a.id) }));
}

export async function monitoringSummary(organizationId: string) {
  const [monitors] = await db
    .select({ active: sql<number>`count(*) filter (where ${schema.monitor.enabled})`.mapWith(Number), total: count() })
    .from(schema.monitor)
    .where(eq(schema.monitor.organizationId, organizationId));
  const [alerts] = await db
    .select({ total: count() })
    .from(schema.alert)
    .where(and(eq(schema.alert.organizationId, organizationId), gte(schema.alert.createdAt, since(24)), eq(schema.alert.test, false)));
  const [deliveries] = await db
    .select({
      delivered: sql<number>`count(*) filter (where ${schema.delivery.status} = 'delivered')`.mapWith(Number),
      failed: sql<number>`count(*) filter (where ${schema.delivery.status} = 'failed')`.mapWith(Number),
      pending: sql<number>`count(*) filter (where ${schema.delivery.status} = 'pending')`.mapWith(Number),
    })
    .from(schema.delivery)
    .innerJoin(schema.alert, eq(schema.delivery.alertId, schema.alert.id))
    .where(and(eq(schema.alert.organizationId, organizationId), gte(schema.delivery.createdAt, since(24 * 7))));
  return { monitors: monitors!, alerts24h: alerts!.total, deliveries: deliveries! };
}
