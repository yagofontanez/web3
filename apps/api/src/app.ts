import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { Redis } from "ioredis";

export type AppDeps = {
  redis?: Redis;
  checks: Record<string, () => Promise<unknown>>;
};

export async function buildApp(deps: AppDeps, opts: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: { redact: ["req.headers.authorization", "req.headers['x-api-key']"] },
    trustProxy: true,
    ...opts,
  });

  await app.register(helmet);
  await app.register(cors, { origin: true, methods: ["GET", "POST"] });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    ...(deps.redis ? { redis: deps.redis, nameSpace: "w3s:rl:" } : {}),
  });

  app.get("/health", async (_req, reply) => {
    const results = await Promise.all(
      Object.entries(deps.checks).map(async ([name, check]) => {
        try {
          await check();
          return [name, "ok"] as const;
        } catch {
          return [name, "down"] as const;
        }
      }),
    );
    const status = Object.fromEntries(results);
    const healthy = results.every(([, s]) => s === "ok");
    return reply.code(healthy ? 200 : 503).send({ status: healthy ? "ok" : "degraded", checks: status });
  });

  app.setNotFoundHandler((req, reply) =>
    reply.code(404).send({ error: { code: "not_found", message: `No route for ${req.method} ${req.url}` } }),
  );

  app.setErrorHandler((err: { statusCode?: number; message: string }, req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    reply.code(status).send({
      error: { code: status === 429 ? "rate_limited" : status >= 500 ? "internal_error" : "bad_request", message: status >= 500 ? "Internal server error" : err.message },
    });
  });

  return app;
}
