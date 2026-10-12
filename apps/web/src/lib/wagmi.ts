import { createConfig, http, injected } from "wagmi";
import { mainnet, base, sepolia, baseSepolia, hardhat } from "wagmi/chains";

const local = process.env.NEXT_PUBLIC_STUDIO_LOCAL === "true";

export const wagmiConfig = createConfig({
  chains: local ? [mainnet, base, sepolia, baseSepolia, hardhat] : [mainnet, base, sepolia, baseSepolia],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
