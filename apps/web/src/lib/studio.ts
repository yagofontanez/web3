import { networkBySlug } from "@w3s/explorer";

export const STUDIO_NETWORKS = ["sepolia", "base-sepolia", ...(process.env.STUDIO_LOCAL_RPC ? (["local"] as const) : [])] as const;
export type StudioNetwork = "sepolia" | "base-sepolia" | "local";

export type StudioNet = { slug: StudioNetwork; name: string; chainId: number; explorerUrl: string; rpc: string | null };

export const LOCAL_CHAIN_ID = 31337;

export function studioNetwork(slug: string | null | undefined): StudioNet | null {
  if (slug === "local") {
    const rpc = process.env.STUDIO_LOCAL_RPC;
    return rpc ? { slug: "local", name: "Local devnet", chainId: LOCAL_CHAIN_ID, explorerUrl: "", rpc } : null;
  }
  if (slug !== "sepolia" && slug !== "base-sepolia") return null;
  const n = networkBySlug(slug);
  return n ? { slug, name: n.name, chainId: n.chainId, explorerUrl: n.explorerUrl, rpc: null } : null;
}

export const FAUCETS: Record<StudioNetwork, { name: string; url: string }> = {
  sepolia: { name: "Google Cloud Sepolia faucet", url: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia" },
  "base-sepolia": { name: "Base Sepolia faucets", url: "https://docs.base.org/base-chain/tools/network-faucets" },
  local: { name: "Local accounts are pre-funded", url: "https://hardhat.org/docs" },
};
