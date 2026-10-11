import { getAddress, isAddress } from "viem";
import { normalize } from "viem/ens";
import { getPublicClient } from "@w3s/chains";
import { cached } from "./cache";

export type ResolveResult =
  | { ok: true; address: `0x${string}`; ens: string | null }
  | { ok: false; reason: "invalid" | "not_found" };

export function looksLikeEns(input: string) {
  return /^[^\s.]+(\.[^\s.]+)+$/.test(input) && !input.startsWith("0x");
}

export async function resolveQuery(raw: string): Promise<ResolveResult> {
  const input = raw.trim();
  if (isAddress(input, { strict: false })) {
    const address = getAddress(input);
    return { ok: true, address, ens: await reverseEns(address) };
  }
  if (!looksLikeEns(input)) return { ok: false, reason: "invalid" };

  let name: string;
  try {
    name = normalize(input.toLowerCase());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const address = await cached(`ens:${name}`, 3600, async () => {
    try {
      return (await getPublicClient(1).getEnsAddress({ name })) ?? null;
    } catch {
      return null;
    }
  });
  return address ? { ok: true, address: getAddress(address), ens: name } : { ok: false, reason: "not_found" };
}

export async function reverseEns(address: `0x${string}`): Promise<string | null> {
  return cached(`ens-reverse:${address.toLowerCase()}`, 3600, async () => {
    try {
      return (await getPublicClient(1).getEnsName({ address })) ?? null;
    } catch {
      return null;
    }
  });
}
