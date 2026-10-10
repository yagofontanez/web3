import { createPublicClient, http, type Chain, type PublicClient } from "viem";
import { base, baseSepolia, mainnet, sepolia, polygon, arbitrum, optimism } from "viem/chains";

export const supportedChains = [mainnet, base, polygon, arbitrum, optimism, sepolia, baseSepolia] as const;
export const testnets = [sepolia, baseSepolia] as const;

export type SupportedChainId = (typeof supportedChains)[number]["id"];

const alchemySubdomain: Record<number, string> = {
  [mainnet.id]: "eth-mainnet",
  [base.id]: "base-mainnet",
  [polygon.id]: "polygon-mainnet",
  [arbitrum.id]: "arb-mainnet",
  [optimism.id]: "opt-mainnet",
  [sepolia.id]: "eth-sepolia",
  [baseSepolia.id]: "base-sepolia",
};

export function getChain(chainId: number): Chain | undefined {
  return supportedChains.find((c) => c.id === chainId);
}

export function rpcUrl(chainId: number, alchemyKey = process.env.ALCHEMY_API_KEY): string | undefined {
  const sub = alchemySubdomain[chainId];
  if (alchemyKey && sub) return `https://${sub}.g.alchemy.com/v2/${alchemyKey}`;
  return getChain(chainId)?.rpcUrls.default.http[0];
}

const clients = new Map<number, PublicClient>();

export function getPublicClient(chainId: number): PublicClient {
  const cached = clients.get(chainId);
  if (cached) return cached;
  const chain = getChain(chainId);
  if (!chain) throw new Error(`Unsupported chain ${chainId}`);
  const client = createPublicClient({ chain, transport: http(rpcUrl(chainId)) }) as PublicClient;
  clients.set(chainId, client);
  return client;
}
