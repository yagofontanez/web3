import { keccak256, toHex } from "viem";
import { HashGlyph } from "./chain/hash-glyph";

export function OrgGlyph({ id, className = "" }: { id: string; className?: string }) {
  return (
    <span className={`inline-block shrink-0 rounded-md bg-surface p-[3px] ring-1 ring-line ${className}`}>
      <HashGlyph hash={keccak256(toHex(id))} animate={false} gap={0.18} className="block size-full" />
    </span>
  );
}
