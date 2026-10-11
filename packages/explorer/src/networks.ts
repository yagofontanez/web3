import { arbitrum, base, baseSepolia, mainnet, optimism, polygon, sepolia, type Chain } from "viem/chains";

export type ExplorerNetwork = {
  chainId: number;
  slug: string;
  name: string;
  alchemy: string;
  nativeSymbol: string;
  testnet: boolean;
  internalTransfers: boolean;
  explorerUrl: string;
};

const make = (chain: Chain, slug: string, alchemy: string, internalTransfers = false): ExplorerNetwork => ({
  chainId: chain.id,
  slug,
  name: chain.name === "OP Mainnet" ? "Optimism" : chain.name.replace(" One", ""),
  alchemy,
  nativeSymbol: chain.nativeCurrency.symbol,
  testnet: Boolean(chain.testnet),
  internalTransfers,
  explorerUrl: chain.blockExplorers?.default.url ?? "",
});

export const networks: ExplorerNetwork[] = [
  make(mainnet, "ethereum", "eth-mainnet", true),
  make(base, "base", "base-mainnet"),
  make(polygon, "polygon", "polygon-mainnet", true),
  make(arbitrum, "arbitrum", "arb-mainnet"),
  make(optimism, "optimism", "opt-mainnet"),
  make(sepolia, "sepolia", "eth-sepolia"),
  make(baseSepolia, "base-sepolia", "base-sepolia"),
];

export const mainnets = networks.filter((n) => !n.testnet);

export function networkBySlug(slug: string | undefined | null): ExplorerNetwork | undefined {
  return networks.find((n) => n.slug === slug);
}

export function networkByAlchemy(alchemy: string): ExplorerNetwork | undefined {
  return networks.find((n) => n.alchemy === alchemy);
}

export function txUrl(network: ExplorerNetwork, hash: string) {
  return `${network.explorerUrl}/tx/${hash}`;
}

export function addressUrl(network: ExplorerNetwork, address: string) {
  return `${network.explorerUrl}/address/${address}`;
}
