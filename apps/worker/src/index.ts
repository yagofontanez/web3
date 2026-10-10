import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { sql } from "@w3s/db";
import { QUEUES } from "./queues";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:56379", { maxRetriesPerRequest: null });

const systemQueue = new Queue(QUEUES.system, { connection });
await systemQueue.upsertJobScheduler("heartbeat", { every: 60_000 }, { name: "heartbeat" });

const worker = new Worker(
  QUEUES.system,
  async (job) => {
    if (job.name === "heartbeat") {
      await sql`select 1`;
      return { ok: true, at: new Date().toISOString() };
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
