import { and, count, eq, gte, inArray, isNull, sql as dsql } from "drizzle-orm";
import type { Queue } from "bullmq";
import { db, schema } from "@w3s/db";
import type { AlertPayload } from "@w3s/db/schema";
import { alertTitle } from "@w3s/notify";
import { networkBySlug } from "@w3s/explorer";
import { HOURLY_PAUSE_LIMIT, MAX_EVENT_RANGE, nextRange, throttle, type MonitorLike } from "./match";
import { latestBlock, scanMonitor } from "./scan";

export type DeliveryJob = { deliveryId: string };

export async function createAlert(
  monitor: { id: string; name: string; organizationId: string },
  found: { dedupeKey: string; payload: AlertPayload; title?: string },
  deliveries: Queue<DeliveryJob>,
  test = false,
) {
  const [created] = await db
    .insert(schema.alert)
    .values({
      organizationId: monitor.organizationId,
      monitorId: monitor.id,
      dedupeKey: found.dedupeKey,
      title: found.title ?? alertTitle(monitor.name, found.payload),
      payload: found.payload,
      test,
    })
    .onConflictDoNothing()
    .returning({ id: schema.alert.id });
  if (!created) return null;

  const channels = await db
    .select({ id: schema.notificationChannel.id })
    .from(schema.monitorChannel)
    .innerJoin(schema.notificationChannel, eq(schema.monitorChannel.channelId, schema.notificationChannel.id))
    .where(and(eq(schema.monitorChannel.monitorId, monitor.id), isNull(schema.notificationChannel.disabledAt)));
  if (channels.length === 0) return created.id;

  const rows = await db
    .insert(schema.delivery)
    .values(channels.map((c) => ({ alertId: created.id, channelId: c.id })))
    .onConflictDoNothing()
    .returning({ id: schema.delivery.id });
  await deliveries.addBulk(rows.map((r) => ({ name: "deliver", data: { deliveryId: r.id }, opts: { jobId: r.id } })));
  return created.id;
}

export async function runScan(deliveries: Queue<DeliveryJob>) {
  const monitors = await db.select().from(schema.monitor).where(eq(schema.monitor.enabled, true));
  if (monitors.length === 0) return { monitors: 0, alerts: 0 };

  const networks = [...new Set(monitors.map((m) => m.network))];
  const heads = new Map<string, number>();
  await Promise.all(
    networks.map(async (n) => {
      try {
        heads.set(n, await latestBlock(n));
      } catch (err) {
        console.error(`[monitors] could not read head of ${n}:`, err instanceof Error ? err.message : err);
      }
    }),
  );

  let alerts = 0;
  for (const m of monitors) {
    const head = heads.get(m.network);
    if (head === undefined) continue;
    if (m.lastCheckedBlock === null) {
      await db.update(schema.monitor).set({ lastCheckedBlock: head, lastError: null }).where(eq(schema.monitor.id, m.id));
      continue;
    }
    const range = nextRange(m.lastCheckedBlock, head, m.kind === "event" ? MAX_EVENT_RANGE : undefined);
    if (!range) continue;
    try {
      const found = await scanMonitor(m as MonitorLike, range.from, range.to);
      const { send, suppressed } = throttle(found);
      let created = 0;
      for (const f of send) if (await createAlert(m, f, deliveries)) created++;
      if (suppressed > 0) {
        const last = found.at(-1)!;
        const blocks = range.to - range.from + 1;
        const summary = await createAlert(
          m,
          {
            dedupeKey: `burst:${range.from}-${range.to}`,
            title: `${m.name}: ${found.length} matches in ${blocks} blocks on ${networkBySlug(m.network)?.name ?? m.network}. Sent the first ${send.length}, held back ${suppressed}.`,
            payload: { ...last.payload, txHash: last.payload.txHash },
          },
          deliveries,
        );
        if (summary) created++;
      }
      alerts += created;

      const [recent] = await db
        .select({ total: count() })
        .from(schema.alert)
        .where(and(eq(schema.alert.monitorId, m.id), eq(schema.alert.test, false), gte(schema.alert.createdAt, dsql`now() - interval '1 hour'`)));
      const overLimit = (recent?.total ?? 0) > HOURLY_PAUSE_LIMIT;
      if (overLimit) {
        await createAlert(
          m,
          {
            dedupeKey: `paused:${range.to}`,
            title: `${m.name} was paused: more than ${HOURLY_PAUSE_LIMIT} alerts in the last hour. Add a minimum amount or narrow the asset, then resume it.`,
            payload: found.at(-1)?.payload ?? { kind: m.kind, network: m.network, txHash: "0x", blockNumber: range.to, timestamp: null, address: m.address },
          },
          deliveries,
        );
      }
      await db
        .update(schema.monitor)
        .set({
          lastCheckedBlock: range.to,
          lastError: overLimit ? `Paused automatically after more than ${HOURLY_PAUSE_LIMIT} alerts in an hour. Narrow the conditions, then resume it.` : null,
          ...(overLimit ? { enabled: false } : {}),
          ...(created ? { lastTriggeredAt: new Date() } : {}),
        })
        .where(eq(schema.monitor.id, m.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[monitors] ${m.id} failed:`, message);
      await db.update(schema.monitor).set({ lastError: message.slice(0, 500) }).where(eq(schema.monitor.id, m.id));
    }
  }
  return { monitors: monitors.length, alerts };
}

export async function pendingDeliveryIds() {
  const rows = await db.select({ id: schema.delivery.id }).from(schema.delivery).where(inArray(schema.delivery.status, ["pending"]));
  return rows.map((r) => r.id);
}
