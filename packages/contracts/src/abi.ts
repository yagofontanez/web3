export type AbiParam = { name?: string; type: string; components?: AbiParam[]; internalType?: string };
export type AbiFunction = { type: "function"; name: string; inputs: AbiParam[]; outputs?: AbiParam[]; stateMutability: "pure" | "view" | "nonpayable" | "payable" };
export type AbiItem = { type: string; name?: string; inputs?: AbiParam[]; outputs?: AbiParam[]; stateMutability?: string };

export function functionsOf(abi: readonly unknown[]) {
  const fns = (abi as AbiItem[]).filter((i): i is AbiFunction => i.type === "function" && typeof i.name === "string");
  const sort = (a: AbiFunction, b: AbiFunction) => a.inputs.length - b.inputs.length || a.name.localeCompare(b.name);
  return {
    reads: fns.filter((f) => f.stateMutability === "view" || f.stateMutability === "pure").sort(sort),
    writes: fns.filter((f) => f.stateMutability === "nonpayable" || f.stateMutability === "payable").sort(sort),
  };
}

export function constructorOf(abi: readonly unknown[]) {
  return (abi as AbiItem[]).find((i) => i.type === "constructor")?.inputs ?? [];
}

export function signature(f: AbiFunction) {
  return `${f.name}(${f.inputs.map((i) => i.type).join(",")})`;
}

export function placeholder(p: AbiParam) {
  if (p.type === "address") return "0x…";
  if (p.type === "bool") return "true or false";
  if (/^u?int/.test(p.type) && !p.type.endsWith("]")) return "123";
  if (p.type.startsWith("bytes")) return "0x…";
  if (p.type.endsWith("]") || p.type === "tuple") return "JSON, e.g. [\"0x…\", 1]";
  return p.type;
}

function coerce(p: AbiParam, raw: unknown, path: string): unknown {
  const type = p.type;
  if (type.endsWith("]")) {
    const inner: AbiParam = { ...p, type: type.slice(0, type.lastIndexOf("[")) };
    const fixed = type.match(/\[(\d+)\]$/);
    const list = typeof raw === "string" ? JSON.parse(raw || "[]") : raw;
    if (!Array.isArray(list)) throw new Error(`${path} must be a JSON array.`);
    if (fixed && list.length !== Number(fixed[1])) throw new Error(`${path} needs exactly ${fixed[1]} items.`);
    return list.map((v, i) => coerce(inner, v, `${path}[${i}]`));
  }
  if (type === "tuple") {
    const obj = typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
    const comps = p.components ?? [];
    if (Array.isArray(obj)) return comps.map((c, i) => coerce(c, obj[i], `${path}.${c.name || i}`));
    if (obj && typeof obj === "object") return Object.fromEntries(comps.map((c, i) => [c.name || String(i), coerce(c, (obj as Record<string, unknown>)[c.name || String(i)], `${path}.${c.name || i}`)]));
    throw new Error(`${path} must be a JSON object or array.`);
  }
  const s = typeof raw === "string" ? raw.trim() : raw;
  if (type === "address") {
    if (typeof s !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(s)) throw new Error(`${path} must be a 0x address with 40 hex characters.`);
    return s;
  }
  if (type === "bool") {
    if (s === true || s === "true" || s === "1") return true;
    if (s === false || s === "false" || s === "0") return false;
    throw new Error(`${path} must be true or false.`);
  }
  if (/^u?int\d*$/.test(type)) {
    const str = typeof s === "number" ? String(s) : String(s ?? "");
    if (!/^-?\d+$/.test(str)) throw new Error(`${path} must be a whole number (no decimals or commas).`);
    const n = BigInt(str);
    if (type.startsWith("uint") && n < 0n) throw new Error(`${path} can't be negative.`);
    const bits = BigInt(type.replace(/^u?int/, "") || "256");
    const limit = type.startsWith("uint") ? 2n ** bits : 2n ** (bits - 1n);
    if (n >= limit || (!type.startsWith("uint") && n < -limit)) throw new Error(`${path} is too large for ${type}.`);
    return n;
  }
  if (type.startsWith("bytes")) {
    if (typeof s !== "string" || !/^0x([0-9a-fA-F]{2})*$/.test(s)) throw new Error(`${path} must be 0x-prefixed hex bytes.`);
    const size = type.slice(5);
    if (size && (s.length - 2) / 2 !== Number(size)) throw new Error(`${path} must be exactly ${size} bytes.`);
    return s;
  }
  if (type === "string") return String(s ?? "");
  throw new Error(`${path} has an unsupported type ${type}.`);
}

export function parseArgs(params: AbiParam[], values: string[]) {
  return params.map((p, i) => {
    try {
      return coerce(p, values[i] ?? "", p.name || `argument ${i + 1}`);
    } catch (err) {
      if (err instanceof SyntaxError) throw new Error(`${p.name || `argument ${i + 1}`} isn't valid JSON.`);
      throw err;
    }
  });
}

export function formatValue(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  if (value && typeof value === "object") return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  return String(value);
}
