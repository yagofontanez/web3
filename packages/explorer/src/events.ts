import { decodeEventLog, formatUnits, parseAbiItem, toEventSelector, type AbiEvent } from "viem";

export type ParsedEvent = { name: string; topic0: `0x${string}`; abi: AbiEvent; canonical: string };

export function parseEventSignature(input: string): ParsedEvent | { error: string } {
  const raw = input.trim().replace(/;$/, "");
  if (!raw) return { error: "Enter an event signature." };
  const source = raw.startsWith("event ") ? raw : `event ${raw}`;
  try {
    const item = parseAbiItem(source) as AbiEvent;
    if (item.type !== "event") return { error: "That isn't an event." };
    const canonical = `${item.name}(${item.inputs.map((i) => i.type).join(",")})`;
    return { name: item.name, topic0: toEventSelector(item), abi: item, canonical };
  } catch {
    return { error: "Couldn't parse that. Use the Solidity form, like Transfer(address indexed from, address indexed to, uint256 value)." };
  }
}

function stringify(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return `[${value.map(stringify).join(", ")}]`;
  if (value && typeof value === "object") return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return String(value);
}

export function decodeEvent(parsed: ParsedEvent, log: { data: `0x${string}`; topics: `0x${string}`[] }): Record<string, string> | null {
  try {
    const decoded = decodeEventLog({ abi: [parsed.abi], data: log.data, topics: log.topics as [`0x${string}`, ...`0x${string}`[]] });
    const args = decoded.args as Record<string, unknown> | unknown[] | undefined;
    if (!args) return {};
    if (Array.isArray(args)) return Object.fromEntries(args.map((v, i) => [`arg${i}`, stringify(v)]));
    return Object.fromEntries(Object.entries(args).map(([k, v]) => [k, stringify(v)]));
  } catch {
    return null;
  }
}

export function formatTokenValue(raw: string | bigint, decimals: number) {
  return formatUnits(typeof raw === "bigint" ? raw : BigInt(raw), decimals);
}
