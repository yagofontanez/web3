import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { lt, sql as dsql } from "drizzle-orm";
import { db, schema, sql } from "@w3s/db";
import { DELIVERY_ATTEMPTS, deliver } from "./monitoring/deliver";
import { pendingDeliveryIds, runScan, type DeliveryJob } from "./monitoring/process";
import { QUEUES } from "./queues";
import { startTelegramPoller } from "./telegram";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:56379", { maxRetriesPerRequest: null });
const pollerRedis = new Redis(process.env.REDIS_URL ?? "redis://localhost:56379", { maxRetriesPerRequest: 2 });

const systemQueue = new Queue(QUEUES.system, { connection });
const deliveryQueue = new Queue<DeliveryJob>(QUEUES.deliveries, {
  connection,
  defaultJobOptions: { attempts: DELIVERY_ATTEMPTS, backoff: { type: "exponential", delay: 15_000 }, removeOnComplete: 1000, removeOnFail: 1000 },
});

await systemQueue.upsertJobScheduler("heartbeat", { every: 60_000 }, { name: "heartbeat" });
await systemQueue.upsertJobScheduler("scan-monitors", { every: 30_000 }, { name: "scan-monitors" });
await systemQueue.upsertJobScheduler("prune-request-logs", { pattern: "15 3 * * *" }, { name: "prune-request-logs" });

const LOG_RETENTION_DAYS = 30;

const system = new Worker(
  QUEUES.system,
  async (job) => {
    if (job.name === "heartbeat") {
      await sql`select 1`;
      const pending = await pendingDeliveryIds();
      if (pending.length) await deliveryQueue.addBulk(pending.map((id) => ({ name: "deliver", data: { deliveryId: id }, opts: { jobId: id } })));
      return { ok: true, requeued: pending.length };
    }
    if (job.name === "scan-monitors") return runScan(deliveryQueue);
    if (job.name === "prune-request-logs") {
      const deleted = await db
        .delete(schema.apiRequestLog)
        .where(lt(schema.apiRequestLog.createdAt, dsql`now() - make_interval(days => ${LOG_RETENTION_DAYS})`))
        .returning({ id: schema.apiRequestLog.id });
      return { deleted: deleted.length };
    }
    throw new Error(`Unknown job ${job.name}`);
  },
  { connection, concurrency: 1 },
);

const deliveries = new Worker<DeliveryJob>(QUEUES.deliveries, deliver, { connection, concurrency: 10 });

system.on("completed", (job, result) => {
  if (job.name === "scan-monitors" && (result as { alerts?: number })?.alerts) console.log(`[worker] scan created ${(result as { alerts: number }).alerts} alerts`);
});
system.on("failed", (job, err) => console.error(`[worker] ${job?.name} failed:`, err.message));
deliveries.on("completed", (job) => console.log(`[worker] delivered ${job.data.deliveryId}`));
deliveries.on("failed", (job, err) => console.error(`[worker] delivery ${job?.data.deliveryId} attempt ${job?.attemptsMade} failed: ${err.message}`));

const stopTelegram = startTelegramPoller(pollerRedis);
console.log("[worker] listening on", Object.values(QUEUES).join(", "));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    stopTelegram();
    await Promise.all([system.close(), deliveries.close()]);
    await Promise.all([systemQueue.close(), deliveryQueue.close()]);
    await Promise.all([connection.quit(), pollerRedis.quit(), sql.end()]);
    process.exit(0);
  });
}
