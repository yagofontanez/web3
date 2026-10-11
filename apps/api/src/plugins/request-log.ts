import type { FastifyInstance } from "fastify";
import type { LogSink } from "../types";

export function registerRequestLog(app: FastifyInstance, sink: LogSink) {
  app.addHook("onResponse", async (request, reply) => {
    const key = request.apiKey;
    if (!key) return;
    sink.push({
      organizationId: key.organizationId,
      projectId: key.projectId,
      apiKeyId: key.id,
      method: request.method,
      route: request.routeOptions.url ?? request.url.split("?")[0]!,
      path: request.url.split("?")[0]!.slice(0, 512),
      status: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
      errorCode: request.errorCode ?? null,
      ip: request.ip ?? null,
      createdAt: new Date(),
    });
  });
}
