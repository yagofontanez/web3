import { createConfig, http, injected } from "wagmi";
import { mainnet, base, sepolia, baseSepolia } from "wagmi/chains";

export const wagmiConfig = createConfig({
  chains: [mainnet, base, sepolia, baseSepolia],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
