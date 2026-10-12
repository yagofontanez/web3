import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, normalize } from "node:path";

function requireFrom() {
  const anchors = [join(process.cwd(), "package.json"), import.meta.url];
  for (const anchor of anchors) {
    try {
      const req = createRequire(anchor);
      const pkg = req.resolve("@openzeppelin/contracts/package.json");
      if (existsSync(pkg)) return { req, ozRoot: dirname(pkg) };
    } catch {}
  }
  throw new Error("Couldn't locate @openzeppelin/contracts. Install it next to the app that runs the compiler.");
}

let resolved: ReturnType<typeof requireFrom> | null = null;
const deps = () => (resolved ??= requireFrom());

export const COMPILER = { version: "0.8.37", evmVersion: "cancun", optimizerRuns: 200 } as const;

type Solc = { compile(input: string, opts: { import: (path: string) => { contents: string } | { error: string } }): string; version(): string };
let solcInstance: Solc | null = null;
function solc(): Solc {
  solcInstance ??= deps().req("solc") as Solc;
  return solcInstance;
}

function findImports(path: string) {
  if (!path.startsWith("@openzeppelin/contracts/")) return { error: `Only @openzeppelin/contracts imports are available (got ${path}).` };
  const rel = normalize(path.slice("@openzeppelin/contracts/".length));
  if (rel.startsWith("..")) return { error: "Invalid import path." };
  try {
    return { contents: readFileSync(join(deps().ozRoot, rel), "utf8") };
  } catch {
    return { error: `File not found: ${path}` };
  }
}

export type CompileMessage = { severity: "error" | "warning" | "info"; message: string; line: number | null };
export type CompileResult =
  | { ok: true; contractName: string; abi: unknown[]; bytecode: `0x${string}`; standardJson: string; messages: CompileMessage[]; compilerVersion: string }
  | { ok: false; messages: CompileMessage[] };

export function buildStandardInput(source: string, file = "Contract.sol") {
  return {
    language: "Solidity",
    sources: { [file]: { content: source } },
    settings: {
      optimizer: { enabled: true, runs: COMPILER.optimizerRuns },
      evmVersion: COMPILER.evmVersion,
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
}

export function compile(source: string, preferred?: string): CompileResult {
  if (source.length > 200_000) return { ok: false, messages: [{ severity: "error", message: "Source is larger than 200 KB.", line: null }] };
  const input = buildStandardInput(source);
  const output = JSON.parse(solc().compile(JSON.stringify(input), { import: findImports })) as {
    errors?: { severity: "error" | "warning" | "info"; formattedMessage: string; message: string; sourceLocation?: { file: string; start: number } }[];
    contracts?: Record<string, Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>>;
  };
  const messages: CompileMessage[] = (output.errors ?? [])
    .filter((e) => e.sourceLocation?.file === "Contract.sol" || e.severity === "error")
    .map((e) => ({
      severity: e.severity,
      message: e.message,
      line: e.sourceLocation?.file === "Contract.sol" ? source.slice(0, e.sourceLocation.start).split("\n").length : null,
    }));
  if (messages.some((m) => m.severity === "error")) return { ok: false, messages };

  const contracts = output.contracts?.["Contract.sol"] ?? {};
  const deployable = Object.entries(contracts).filter(([, c]) => c.evm.bytecode.object.length > 0);
  const chosen = deployable.find(([n]) => n === preferred) ?? deployable.at(-1);
  if (!chosen) return { ok: false, messages: [...messages, { severity: "error", message: "No deployable contract found. Abstract contracts and interfaces can't be deployed.", line: null }] };

  const standard = { ...input, settings: { ...input.settings, outputSelection: { "*": { "*": ["*"] } } } };
  const resolved: Record<string, { content: string }> = { "Contract.sol": { content: source } };
  const pending = [...source.matchAll(/import\s+(?:\{[^}]*\}\s+from\s+)?"([^"]+)"/g)].map((m) => m[1]!);
  while (pending.length) {
    const p = pending.pop()!;
    if (resolved[p]) continue;
    const r = findImports(p);
    if ("error" in r) continue;
    resolved[p] = { content: r.contents };
    const dir = p.split("/").slice(0, -1).join("/");
    for (const m of r.contents.matchAll(/import\s+(?:\{[^}]*\}\s+from\s+)?"([^"]+)"/g)) {
      const spec = m[1]!;
      pending.push(spec.startsWith(".") ? normalize(join(dir, spec)).replace(/\\/g, "/") : spec);
    }
  }
  standard.sources = resolved;

  return {
    ok: true,
    contractName: chosen[0],
    abi: chosen[1].abi,
    bytecode: `0x${chosen[1].evm.bytecode.object}`,
    standardJson: JSON.stringify(standard),
    messages,
    compilerVersion: solc().version(),
  };
}
