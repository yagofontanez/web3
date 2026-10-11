import { dataApi } from "./alchemy";
import { cached } from "./cache";
import { ExplorerError, type ExplorerErrorCode } from "./errors";
import { hexToBigInt, toDecimal, usd } from "./format";
import { mainnets, type ExplorerNetwork } from "./networks";

export type TokenHolding = {
  network: string;
  contract: string | null;
  symbol: string;
  name: string;
  logo: string | null;
  decimals: number;
  balance: string;
  priceUsd: number | null;
  valueUsd: number | null;
};

export type NetworkHoldings = {
  network: string;
  holdings: TokenHolding[];
  totalUsd: number;
  truncated: boolean;
  error: ExplorerErrorCode | null;
};

type RawToken = {
  tokenAddress: string | null;
  tokenBalance: string;
  tokenMetadata?: { symbol: string | null; decimals: number | null; name: string | null; logo: string | null };
  tokenPrices?: { currency: string; value: string }[];
};

const MAX_PAGES = 5;

export function parseToken(network: ExplorerNetwork, t: RawToken): TokenHolding | null {
  const raw = hexToBigInt(t.tokenBalance);
  if (raw === 0n) return null;
  const native = t.tokenAddress === null;
  const decimals = native ? 18 : t.tokenMetadata?.decimals;
  if (decimals === null || decimals === undefined) return null;
  const balance = toDecimal(raw, decimals);
  const priceRaw = t.tokenPrices?.find((p) => p.currency === "usd")?.value;
  const price = priceRaw !== undefined && Number(priceRaw) > 0 ? Number(priceRaw) : null;
  return {
    network: network.slug,
    contract: t.tokenAddress,
    symbol: native ? network.nativeSymbol : (t.tokenMetadata?.symbol ?? "?"),
    name: native ? `${network.name} native token` : (t.tokenMetadata?.name ?? "Unknown token"),
    logo: native ? null : (t.tokenMetadata?.logo ?? null),
    decimals,
    balance,
    priceUsd: price,
    valueUsd: usd(balance, price),
  };
}

export function sortHoldings(a: TokenHolding, b: TokenHolding) {
  if (a.contract === null && b.contract !== null) return -1;
  if (b.contract === null && a.contract !== null) return 1;
  return (b.valueUsd ?? -1) - (a.valueUsd ?? -1);
}

async function loadNetwork(address: string, network: ExplorerNetwork): Promise<NetworkHoldings> {
  const holdings: TokenHolding[] = [];
  let pageKey: string | undefined;
  let pages = 0;
  do {
    const res = await dataApi<{ data: { tokens: RawToken[]; pageKey?: string } }>("assets/tokens/by-address", {
      addresses: [{ address, networks: [network.alchemy] }],
      withMetadata: true,
      withPrices: true,
      includeNativeTokens: true,
      pageKey,
    });
    for (const t of res.data.tokens) {
      const h = parseToken(network, t);
      if (h) holdings.push(h);
    }
    pageKey = res.data.pageKey;
    pages++;
  } while (pageKey && pages < MAX_PAGES);

  holdings.sort(sortHoldings);
  return {
    network: network.slug,
    holdings,
    totalUsd: holdings.reduce((sum, h) => sum + (h.valueUsd ?? 0), 0),
    truncated: Boolean(pageKey),
    error: null,
  };
}

export async function getHoldings(address: string, network: ExplorerNetwork): Promise<NetworkHoldings> {
  try {
    return await cached(`holdings:${network.slug}:${address.toLowerCase()}`, 60, () => loadNetwork(address, network));
  } catch (err) {
    return {
      network: network.slug,
      holdings: [],
      totalUsd: 0,
      truncated: false,
      error: err instanceof ExplorerError ? err.code : "upstream",
    };
  }
}

export async function getPortfolio(address: string, list: ExplorerNetwork[] = mainnets) {
  const byNetwork = await Promise.all(list.map((n) => getHoldings(address, n)));
  return {
    byNetwork,
    totalUsd: byNetwork.reduce((sum, n) => sum + n.totalUsd, 0),
  };
}
