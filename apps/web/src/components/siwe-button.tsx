"use client";

import { useState } from "react";
import { createSiweMessage } from "viem/siwe";
import { useConnect, useConnection, useConnectors, useSignMessage } from "wagmi";
import { authClient } from "@/lib/auth-client";
import { reloadTo } from "@/lib/navigation";
import { Button, FormError } from "./ui";

export function SiweButton({ next = "/dashboard" }: { next?: string }) {
  const connectors = useConnectors();
  const { connectAsync } = useConnect();
  const connection = useConnection();
  const { signMessageAsync } = useSignMessage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    setPending(true);
    try {
      let address = connection.address;
      let chainId = connection.chainId;
      if (!address || !chainId) {
        const connector = connectors[0];
        if (!connector) throw new Error("No browser wallet found. Install MetaMask or Rabby and try again.");
        const result = await connectAsync({ connector });
        address = result.accounts[0];
        chainId = result.chainId;
      }
      if (!address || !chainId) throw new Error("Your wallet did not share an account.");

      const { data: nonceData, error: nonceError } = await authClient.siwe.nonce();
      if (nonceError || !nonceData) throw new Error(nonceError?.message ?? "Could not start wallet sign-in.");

      const message = createSiweMessage({
        domain: window.location.host,
        address,
        chainId,
        nonce: nonceData.nonce,
        uri: window.location.origin,
        version: "1",
        statement: "Sign in to Systema. This request does not trigger a transaction or cost gas.",
      });
      const signature = await signMessageAsync({ message });
      const { error: verifyError } = await authClient.siwe.verify({ message, signature });
      if (verifyError) throw new Error(verifyError.message ?? "Signature could not be verified.");

      reloadTo(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(/rejected|denied/i.test(msg) ? "You declined the signature request in your wallet." : msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" onClick={signIn} disabled={pending}>
        {pending ? "Waiting for wallet…" : "Continue with wallet"}
      </Button>
      <FormError message={error} />
    </div>
  );
}
