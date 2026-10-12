import { describe, expect, it } from "vitest";
import { generateApiKey } from "@w3s/shared/api-keys";
import { buildApp, type AppDeps } from "./app";
import type { ApiKeyRecord, RequestLogEntry } from "./types";

const PEPPER = "p".repeat(40);
const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

function setup(over: Partial<AppDeps> = {}, record: Partial<ApiKeyRecord> = {}) {
  const live = generateApiKey(PEPPER);
  const revoked = generateApiKey(PEPPER);
  const logs: RequestLogEntry[] = [];
  const base: ApiKeyRecord = { id: "key_1", organizationId: "org_1", projectId: "prj_1", rateLimitPerMinute: 100, revoked: false, ...record };
  const deps: AppDeps = {
    pepper: PEPPER,
    checks: {},
    logs: { push: (e) => logs.push(e) },
    keys: {
      findByHash: async (hash) =>
        hash === live.hash ? base : hash === revoked.hash ? { ...base, id: "key_2", revoked: true } : null,
    },
    explorer: {
      resolve: async (q) => (q === "vitalik.eth" ? { ok: true, address: VITALIK, ens: "vitalik.eth" } : { ok: false, reason: "not_found" }),
      portfolio: async (_a, nets) => ({
        totalUsd: 1234.567,
        byNetwork: nets.map((n) => ({
          network: n.slug,
          totalUsd: 1234.567,
          truncated: false,
          error: null,
          holdings: [
            { network: n.slug, contract: null, symbol: "ETH", name: "Ether", logo: null, decimals: 18, balance: "0.5", priceUsd: 2469.13, valueUsd: 1234.567 },
            { network: n.slug, contract: "0xspam", symbol: "SPAM", name: "Spam", logo: null, decimals: 18, balance: "1000", priceUsd: null, valueUsd: null },
          ],
        })),
      }),
      nfts: async () => ({ items: [], spamHidden: 3, nextCursor: null, error: null }),
      activity: async () => ({ items: [], nextCursor: null, error: "network_disabled" }),
    },
    ...over,
  };
  return { deps, live, revoked, logs };
}

const bearer = (key: string) => ({ authorization: `Bearer ${key}` });

describe("public api", () => {
  it("reports health and returns a consistent 404 envelope", async () => {
    const { deps } = setup({ checks: { db: async () => 1, redis: async () => Promise.reject(new Error("x")) } });
    const app = await buildApp(deps, { logger: false });
    const health = await app.inject("/health");
    expect(health.statusCode).toBe(503);
    expect(health.json().checks).toEqual({ db: "ok", redis: "down" });
    const missing = await app.inject("/nope");
    expect(missing.json().error.code).toBe("not_found");
  });

  it("rejects missing, malformed, unknown and revoked keys", async () => {
    const { deps, revoked } = setup();
    const app = await buildApp(deps, { logger: false });
    const cases = [
      {},
      bearer("sk_test_123"),
      bearer(`w3s_live_${"A".repeat(32)}`),
      bearer(revoked.key),
    ];
    for (const headers of cases) {
      const res = await app.inject({ url: "/v1/networks", headers });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe("unauthorized");
    }
  });

  it("accepts the key in Authorization or x-api-key and logs the request", async () => {
    const { deps, live, logs } = setup();
    const app = await buildApp(deps, { logger: false });
    const a = await app.inject({ url: "/v1/networks", headers: bearer(live.key) });
    const b = await app.inject({ url: "/v1/networks", headers: { "x-api-key": live.key } });
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(a.json().data.some((n: { slug: string }) => n.slug === "base")).toBe(true);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ apiKeyId: "key_1", projectId: "prj_1", route: "/v1/networks", status: 200, errorCode: null });
  });

  it("resolves ENS names in address routes and hides unpriced tokens by default", async () => {
    const { deps, live } = setup();
    const app = await buildApp(deps, { logger: false });
    const res = await app.inject({ url: "/v1/addresses/vitalik.eth/tokens?network=base", headers: bearer(live.key) });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meta).toMatchObject({ address: VITALIK, ens: "vitalik.eth", network: "base", unpricedHidden: 1 });
    expect(body.data.map((t: { symbol: string }) => t.symbol)).toEqual(["ETH"]);
    const all = await app.inject({ url: `/v1/addresses/${VITALIK}/tokens?includeUnpriced=true`, headers: bearer(live.key) });
    expect(all.json().data).toHaveLength(2);
  });

  it("returns clear 4xx errors and maps provider failures to 5xx", async () => {
    const { deps, live, logs } = setup();
    const app = await buildApp(deps, { logger: false });
    const badNet = await app.inject({ url: `/v1/addresses/${VITALIK}/nfts?network=solana`, headers: bearer(live.key) });
    expect(badNet.statusCode).toBe(400);
    expect(badNet.json().error.message).toContain("Unknown network");
    const unknown = await app.inject({ url: "/v1/addresses/nobody.eth/portfolio", headers: bearer(live.key) });
    expect(unknown.statusCode).toBe(404);
    const provider = await app.inject({ url: `/v1/addresses/${VITALIK}/activity`, headers: bearer(live.key) });
    expect(provider.statusCode).toBe(502);
    expect(provider.json().error.code).toBe("upstream_network_disabled");
    expect(logs.map((l) => l.errorCode)).toEqual(["bad_request", "not_found", "upstream_network_disabled"]);
  });

  it("enforces each key's own per-minute limit", async () => {
    const { deps, live, logs } = setup({}, { rateLimitPerMinute: 2 });
    const app = await buildApp(deps, { logger: false });
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await app.inject({ url: "/v1/networks", headers: bearer(live.key) })).statusCode);
    expect(statuses).toEqual([200, 200, 429]);
    const limited = await app.inject({ url: "/v1/networks", headers: bearer(live.key) });
    expect(limited.json().error.code).toBe("rate_limited");
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(logs.at(-1)).toMatchObject({ status: 429, errorCode: "rate_limited" });
  });

  it("counts one limit per key across every endpoint", async () => {
    const { deps, live } = setup({}, { rateLimitPerMinute: 3 });
    const app = await buildApp(deps, { logger: false });
    const urls = ["/v1/networks", "/v1/resolve/vitalik.eth", `/v1/addresses/${VITALIK}/portfolio`, "/v1/networks"];
    const statuses = [];
    for (const url of urls) statuses.push((await app.inject({ url, headers: bearer(live.key) })).statusCode);
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it("does not rate limit the health check", async () => {
    const { deps } = setup();
    const app = await buildApp(deps, { logger: false });
    for (let i = 0; i < 40; i++) expect((await app.inject("/health")).statusCode).toBe(200);
  });

  it("enforces the organization's monthly quota and reports it in headers", async () => {
    const used = new Map<string, number>();
    const resetsAt = new Date(Date.UTC(2026, 10, 1));
    const { deps, live, logs } = setup({
      quota: {
        consume: async (org) => {
          const n = (used.get(org) ?? 0) + 1;
          used.set(org, n);
          return { used: n, limit: 2, plan: "Free", resetsAt };
        },
      },
    });
    const app = await buildApp(deps, { logger: false });
    const responses = [];
    for (let i = 0; i < 3; i++) responses.push(await app.inject({ url: "/v1/networks", headers: bearer(live.key) }));
    expect(responses.map((r) => r.statusCode)).toEqual([200, 200, 402]);
    expect(responses[0]!.headers["x-quota-remaining"]).toBe("1");
    expect(responses[2]!.headers["x-quota-remaining"]).toBe("0");
    expect(responses[2]!.headers["x-quota-reset"]).toBe(String(resetsAt.getTime() / 1000));
    expect(responses[2]!.json().error.code).toBe("quota_exceeded");
    expect(logs.at(-1)).toMatchObject({ status: 402, errorCode: "quota_exceeded" });
  });

  it("keeps serving when the quota store is unavailable", async () => {
    const { deps, live } = setup({ quota: { consume: async () => null } });
    const app = await buildApp(deps, { logger: false });
    const res = await app.inject({ url: "/v1/networks", headers: bearer(live.key) });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-quota-limit"]).toBeUndefined();
  });
});
