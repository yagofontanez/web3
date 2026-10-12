import { Redis } from "ioredis";
import { sql } from "@w3s/db";
import { buildApp } from "./app";
import { batchedLogSink, dbKeyStore, liveExplorer, redisQuotaStore } from "./deps";

const pepper = process.env.API_KEY_PEPPER;
if (!pepper || pepper.length < 32) throw new Error("API_KEY_PEPPER must be set to at least 32 characters");

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:56379", { maxRetriesPerRequest: 2 });
const logs = batchedLogSink();

const app = await buildApp({
  redis,
  pepper,
  keys: dbKeyStore(redis),
  quota: redisQuotaStore(redis),
  explorer: liveExplorer,
  logs,
  checks: {
    postgres: () => sql`select 1`,
    redis: () => redis.ping(),
  },
});

const port = Number(process.env.API_PORT ?? 4100);
await app.listen({ port, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await app.close();
    await logs.stop();
    await Promise.all([redis.quit(), sql.end()]);
    process.exit(0);
  });
}
