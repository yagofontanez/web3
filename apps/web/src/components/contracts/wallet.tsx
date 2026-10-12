"use client";

import { useConnect, useConnection, useConnectors, useSwitchChain } from "wagmi";
import { Button } from "../ui";

export function useTargetChain(chainId: number) {
  const connection = useConnection();
  const connectors = useConnectors();
  const { connectAsync, isPending: connecting } = useConnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const ready = connection.status === "connected" && connection.chainId === chainId;
  return {
    connection,
    ready,
    connecting,
    switching,
    async connect() {
      const connector = connectors[0];
      if (!connector) throw new Error("No browser wallet found. Install MetaMask, Rabby or use Brave Wallet.");
      await connectAsync({ connector, chainId: chainId as never });
    },
    async switchTo() {
      await switchChainAsync({ chainId: chainId as never });
    },
  };
}

export function WalletGate({ chainId, networkName, children }: { chainId: number; networkName: string; children: React.ReactNode }) {
  const t = useTargetChain(chainId);
  if (t.connection.status !== "connected") {
    return (
      <Button onClick={() => t.connect().catch(() => {})} disabled={t.connecting} className="self-start">
        {t.connecting ? "Waiting for wallet…" : "Connect wallet"}
      </Button>
    );
  }
  if (!t.ready) {
    return (
      <Button onClick={() => t.switchTo().catch(() => {})} disabled={t.switching} className="self-start">
        {t.switching ? "Switching…" : `Switch wallet to ${networkName}`}
      </Button>
    );
  }
  return <>{children}</>;
}

export function walletError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/rejected|denied/i.test(msg)) return "You rejected the request in your wallet.";
  if (/insufficient funds/i.test(msg)) return "Not enough test ETH in this wallet to pay for gas. Get some from a faucet and try again.";
  return msg.split("\n")[0]!.slice(0, 240);
}
