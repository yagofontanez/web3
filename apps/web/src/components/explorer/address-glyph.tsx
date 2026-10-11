import { keccak256 } from "viem";
import { HashGlyph } from "../chain/hash-glyph";

export function AddressGlyph({ address, className = "" }: { address: string; className?: string }) {
  return (
    <span className={`inline-block shrink-0 rounded-md bg-surface p-1 ring-1 ring-line ${className}`}>
      <HashGlyph hash={keccak256(address.toLowerCase() as `0x${string}`)} animate={false} gap={0.16} className="block size-full" />
    </span>
  );
}
