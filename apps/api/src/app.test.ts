import { describe, expect, it } from "vitest";
import { buildApp } from "./app";

describe("api", () => {
  it("reports healthy when all checks pass", async () => {
    const app = await buildApp({ checks: { db: async () => 1 } }, { logger: false });
    const res = await app.inject("/health");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", checks: { db: "ok" } });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("returns 503 when a dependency is down", async () => {
    const app = await buildApp(
      { checks: { db: async () => 1, redis: async () => Promise.reject(new Error("x")) } },
      { logger: false },
    );
    const res = await app.inject("/health");
    expect(res.statusCode).toBe(503);
    expect(res.json().checks.redis).toBe("down");
  });

  it("uses a consistent error envelope for unknown routes", async () => {
    const app = await buildApp({ checks: {} }, { logger: false });
    const res = await app.inject("/v1/nope");
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("not_found");
  });
});
