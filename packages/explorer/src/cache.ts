import { Redis } from "ioredis";

const globalForRedis = globalThis as unknown as { __w3sRedis?: Redis | null };

function client(): Redis | null {
  if (globalForRedis.__w3sRedis !== undefined) return globalForRedis.__w3sRedis;
  const url = process.env.REDIS_URL;
  globalForRedis.__w3sRedis = url
    ? new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false })
    : null;
  globalForRedis.__w3sRedis?.on("error", () => {});
  return globalForRedis.__w3sRedis;
}

const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const fullKey = `w3s:explorer:${key}`;
  const redis = client();

  if (redis) {
    try {
      const hit = await redis.get(fullKey);
      if (hit) return JSON.parse(hit) as T;
    } catch {}
  }

  const pending = inflight.get(fullKey) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = load()
    .then(async (value) => {
      if (redis) {
        try {
          await redis.set(fullKey, JSON.stringify(value), "EX", ttlSeconds);
        } catch {}
      }
      return value;
    })
    .finally(() => inflight.delete(fullKey));

  inflight.set(fullKey, promise);
  return promise;
}
