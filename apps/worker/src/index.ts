import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { lt, sql as dsql } from "drizzle-orm";
import { db, schema, sql } from "@w3s/db";
import { QUEUES } from "./queues";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:56379", { maxRetriesPerRequest: null });

const systemQueue = new Queue(QUEUES.system, { connection });
await systemQueue.upsertJobScheduler("heartbeat", { every: 60_000 }, { name: "heartbeat" });
await systemQueue.upsertJobScheduler("prune-request-logs", { pattern: "15 3 * * *" }, { name: "prune-request-logs" });

const LOG_RETENTION_DAYS = 30;

const worker = new Worker(
  QUEUES.system,
  async (job) => {
    if (job.name === "heartbeat") {
      await sql`select 1`;
      return { ok: true, at: new Date().toISOString() };
    }
    if (job.name === "prune-request-logs") {
      const deleted = await db
        .delete(schema.apiRequestLog)
        .where(lt(schema.apiRequestLog.createdAt, dsql`now() - make_interval(days => ${LOG_RETENTION_DAYS})`))
        .returning({ id: schema.apiRequestLog.id });
      return { deleted: deleted.length };
    }
    throw new Error(`Unknown job ${job.name}`);
  },
  { connection, concurrency: 5 },
);

worker.on("completed", (job) => console.log(`[worker] ${job.name} #${job.id} done`));
worker.on("failed", (job, err) => console.error(`[worker] ${job?.name} #${job?.id} failed:`, err.message));
console.log("[worker] listening on", Object.values(QUEUES).join(", "));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await worker.close();
    await systemQueue.close();
    await Promise.all([connection.quit(), sql.end()]);
    process.exit(0);
  });
}
