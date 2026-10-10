import { Redis } from "ioredis";
import { sql } from "@w3s/db";
import { buildApp } from "./app";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:56379", { maxRetriesPerRequest: 2 });

const app = await buildApp({
  redis,
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
    await Promise.all([redis.quit(), sql.end()]);
    process.exit(0);
  });
}
