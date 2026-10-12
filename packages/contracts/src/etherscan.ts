const BASE = "https://api.etherscan.io/v2/api";

type EsResponse<T> = { status: string; message: string; result: T };

function key() {
  const k = process.env.ETHERSCAN_API_KEY;
  if (!k) throw new Error("ETHERSCAN_API_KEY is not set");
  return k;
}

async function call<T>(chainId: number, params: Record<string, string>, body?: URLSearchParams): Promise<EsResponse<T>> {
  const qs = new URLSearchParams({ chainid: String(chainId), apikey: key(), ...params });
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}?${qs}`, {
      method: body ? "POST" : "GET",
      body,
      headers: body ? { "content-type": "application/x-www-form-urlencoded" } : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json()) as EsResponse<T>;
    if (attempt < 4 && typeof json.result === "string" && /rate limit/i.test(json.result)) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      continue;
    }
    return json;
  }
}

export async function fetchVerifiedContract(chainId: number, address: string): Promise<{ ok: true; name: string; abi: unknown[]; compilerVersion: string; proxyName: string | null; implementation: string | null } | { ok: false; error: string }> {
  const r = await call<{ SourceCode: string; ContractName: string; ABI: string; CompilerVersion: string; Proxy: string; Implementation: string }[]>(chainId, {
    module: "contract",
    action: "getsourcecode",
    address,
  });
  if (r.status !== "1" || !Array.isArray(r.result) || !r.result[0]) return { ok: false, error: typeof r.result === "string" ? r.result : r.message };
  const info = r.result[0];
  if (!info.ABI || info.ABI.startsWith("Contract source code not verified")) return { ok: false, error: "This contract isn't verified on the block explorer, so its ABI isn't public." };
  const implementation = info.Proxy === "1" && /^0x[0-9a-fA-F]{40}$/.test(info.Implementation) ? info.Implementation : null;
  if (implementation) {
    const impl = await fetchVerifiedContract(chainId, implementation);
    if (impl.ok) return { ...impl, name: impl.name, proxyName: info.ContractName, implementation };
  }
  return {
    ok: true as const,
    name: info.ContractName || "Imported contract",
    abi: JSON.parse(info.ABI) as unknown[],
    compilerVersion: info.CompilerVersion,
    proxyName: null as string | null,
    implementation: null as string | null,
  };
}

export async function submitVerification(input: { chainId: number; address: string; standardJson: string; contractName: string; compilerVersion: string; constructorArgs: string }) {
  const body = new URLSearchParams({
    codeformat: "solidity-standard-json-input",
    sourceCode: input.standardJson,
    contractaddress: input.address,
    contractname: `Contract.sol:${input.contractName}`,
    compilerversion: `v${input.compilerVersion.replace(/\.Emscripten.*$/, "")}`,
    constructorArguements: input.constructorArgs.replace(/^0x/, ""),
  });
  const r = await call<string>(input.chainId, { module: "contract", action: "verifysourcecode" }, body);
  if (r.status === "1") return { ok: true as const, guid: r.result };
  if (/already verified/i.test(r.result)) return { ok: true as const, guid: null, alreadyVerified: true };
  return { ok: false as const, error: r.result || r.message };
}

export async function verificationStatus(chainId: number, guid: string) {
  const r = await call<string>(chainId, { module: "contract", action: "checkverifystatus", guid });
  if (/pending/i.test(r.result)) return { state: "pending" as const, message: r.result };
  if (r.status === "1" || /already verified/i.test(r.result)) return { state: "verified" as const, message: r.result };
  return { state: "failed" as const, message: r.result };
}
