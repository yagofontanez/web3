import { formatUnits } from "viem";

export function hexToBigInt(hex: string | null | undefined): bigint {
  if (!hex || hex === "0x") return 0n;
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

export function toDecimal(raw: bigint, decimals: number): string {
  return formatUnits(raw, decimals);
}

export function usd(amount: string, price: number | null): number | null {
  if (price === null) return null;
  const n = Number(amount);
  return Number.isFinite(n) ? n * price : null;
}

export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor<T>(cursor: string | null | undefined): T | undefined {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T;
  } catch {
    return undefined;
  }
}
