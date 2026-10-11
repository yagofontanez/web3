import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { mainnets, networkBySlug, networks, normalizeAddress, type ExplorerNetwork } from "@w3s/explorer";
import { badRequest, notFound, upstream } from "../errors";
import type { ExplorerService } from "../types";

const cursorQuery = z.object({ cursor: z.string().max(4096).optional() });

function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw badRequest(issue ? `${issue.path.join(".") || "query"}: ${issue.message}` : "Invalid request");
  }
  return result.data;
}

function network(slug: string | undefined, fallback?: ExplorerNetwork): ExplorerNetwork {
  if (!slug && fallback) return fallback;
  const n = networkBySlug(slug);
  if (!n) throw badRequest(`Unknown network "${slug}". Use one of: ${networks.map((x) => x.slug).join(", ")}.`);
  return n;
}

function failIfUpstream(result: { error: string | null }) {
  if (result.error) throw upstream(result.error, "The blockchain data provider failed for this request. Try again shortly.");
}

export function registerV1(app: FastifyInstance, explorer: ExplorerService) {
  const resolve = async (raw: string) => {
    const direct = normalizeAddress(raw);
    if (direct) return { address: direct, ens: null as string | null };
    const r = await explorer.resolve(raw);
    if (!r.ok) throw r.reason === "not_found" ? notFound(`${raw} doesn't resolve to an address.`) : badRequest("Pass a 0x address or an ENS name.");
    return { address: r.address, ens: r.ens };
  };
  const target = (req: FastifyRequest) => resolve(String((req.params as { address: string }).address).slice(0, 255));
  const base = {};

  app.get("/v1/networks", base, async () => ({
    data: networks.map((n) => ({ slug: n.slug, name: n.name, chainId: n.chainId, testnet: n.testnet, nativeSymbol: n.nativeSymbol })),
  }));

  app.get("/v1/resolve/:name", base, async (req) => {
    const { name } = req.params as { name: string };
    const r = await explorer.resolve(name.slice(0, 255));
    if (!r.ok) throw r.reason === "not_found" ? notFound(`${name} doesn't resolve to an address.`) : badRequest("Pass an ENS name like vitalik.eth.");
    return { data: { name: r.ens, address: r.address } };
  });

  app.get("/v1/addresses/:address/portfolio", base, async (req) => {
    const q = parse(z.object({ networks: z.string().max(200).optional() }), req.query);
    const list = q.networks ? q.networks.split(",").map((s) => network(s.trim())) : mainnets;
    const { address, ens } = await target(req);
    const p = await explorer.portfolio(address, list);
    return {
      data: {
        address,
        ens,
        totalUsd: Number(p.totalUsd.toFixed(2)),
        networks: p.byNetwork.map((n) => ({
          network: n.network,
          totalUsd: Number(n.totalUsd.toFixed(2)),
          tokenCount: n.holdings.length,
          pricedTokenCount: n.holdings.filter((h) => h.valueUsd !== null).length,
          error: n.error,
        })),
      },
    };
  });

  app.get("/v1/addresses/:address/tokens", base, async (req) => {
    const q = parse(
      z.object({ network: z.string().optional(), includeUnpriced: z.enum(["true", "false"]).optional() }),
      req.query,
    );
    const n = network(q.network, mainnets[0]);
    const { address, ens } = await target(req);
    const p = await explorer.portfolio(address, [n]);
    const holdings = p.byNetwork[0]!;
    failIfUpstream(holdings);
    const tokens = q.includeUnpriced === "true" ? holdings.holdings : holdings.holdings.filter((h) => h.valueUsd !== null);
    return {
      data: tokens.map(({ network: _n, ...t }) => t),
      meta: { address, ens, network: n.slug, totalUsd: Number(holdings.totalUsd.toFixed(2)), truncated: holdings.truncated, unpricedHidden: q.includeUnpriced === "true" ? 0 : holdings.holdings.length - tokens.length },
    };
  });

  app.get("/v1/addresses/:address/nfts", base, async (req) => {
    const q = parse(cursorQuery.extend({ network: z.string().optional() }), req.query);
    const n = network(q.network, mainnets[0]);
    const { address, ens } = await target(req);
    const page = await explorer.nfts(address, n, q.cursor);
    failIfUpstream(page);
    return { data: page.items.map(({ network: _n, ...i }) => i), meta: { address, ens, network: n.slug, spamHidden: page.spamHidden, nextCursor: page.nextCursor } };
  });

  app.get("/v1/addresses/:address/activity", base, async (req) => {
    const q = parse(cursorQuery.extend({ network: z.string().optional() }), req.query);
    const n = network(q.network, mainnets[0]);
    const { address, ens } = await target(req);
    const page = await explorer.activity(address, n, q.cursor);
    failIfUpstream(page);
    return { data: page.items, meta: { address, ens, network: n.slug, nextCursor: page.nextCursor } };
  });
}
