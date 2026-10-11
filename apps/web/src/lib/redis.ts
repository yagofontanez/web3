import "server-only";
import { Redis } from "ioredis";

const globalForRedis = globalThis as unknown as { __w3sWebRedis?: Redis };

export function redis() {
  if (!globalForRedis.__w3sWebRedis) {
    globalForRedis.__w3sWebRedis = new Redis(process.env.REDIS_URL ?? "redis://localhost:56379", { maxRetriesPerRequest: 2 });
    globalForRedis.__w3sWebRedis.on("error", () => {});
  }
  return globalForRedis.__w3sWebRedis;
}
