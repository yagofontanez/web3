import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyRequest, type FastifyServerOptions } from "fastify";
import type { Redis } from "ioredis";
import { HttpError } from "./errors";
import { apiKeyAuth } from "./plugins/api-key-auth";
import { registerRequestLog } from "./plugins/request-log";
import { registerV1 } from "./routes/v1";
import type { ExplorerService, KeyStore, LogSink } from "./types";

export type AppDeps = {
  redis?: Redis;
  checks: Record<string, () => Promise<unknown>>;
  keys: KeyStore;
  explorer: ExplorerService;
  logs: LogSink;
  pepper: string;
};

export async function buildApp(deps: AppDeps, opts: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: { redact: ["req.headers.authorization", "req.headers['x-api-key']"] },
    trustProxy: true,
    ...opts,
  });

  await app.register(helmet);
  await app.register(cors, { origin: true, methods: ["GET"], allowedHeaders: ["authorization", "x-api-key", "content-type"] });

  app.setNotFoundHandler((req, reply) =>
    reply.code(404).send({ error: { code: "not_found", message: `No route for ${req.method} ${req.url.split("?")[0]}` } }),
  );

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    const known = err instanceof HttpError;
    const status = known ? err.statusCode : (err.statusCode ?? 500);
    const code = known ? err.code : status === 429 ? "rate_limited" : status >= 500 ? "internal_error" : "bad_request";
    req.errorCode = code;
    if (status >= 500 && !known) req.log.error(err);
    reply.code(status).send({ error: { code, message: status >= 500 && !known ? "Internal server error" : err.message } });
  });

  registerRequestLog(app, deps.logs);

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
    const healthy = results.every(([, s]) => s === "ok");
    return reply.code(healthy ? 200 : 503).send({ status: healthy ? "ok" : "degraded", checks: Object.fromEntries(results) });
  });

  const authenticate = apiKeyAuth(deps.keys, deps.pepper);
  await app.register(async (v1) => {
    v1.addHook("onRequest", authenticate);
    await v1.register(rateLimit, {
      global: true,
      hook: "preHandler",
      timeWindow: "1 minute",
      keyGenerator: (req: FastifyRequest) => `key:${req.apiKey?.id ?? req.ip}`,
      max: (req: FastifyRequest) => req.apiKey?.rateLimitPerMinute ?? 30,
      ...(deps.redis ? { redis: deps.redis, nameSpace: "w3s:rl:" } : {}),
      errorResponseBuilder: (_req, ctx) =>
        new HttpError(429, "rate_limited", `This key is limited to ${ctx.max} requests per minute. Retry in ${Math.ceil(ctx.ttl / 1000)}s.`),
    });
    registerV1(v1, deps.explorer);
  });

  return app;
}
