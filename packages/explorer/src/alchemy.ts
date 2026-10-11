import { classifyUpstream, ExplorerError } from "./errors";

const TIMEOUT_MS = 15_000;

function key() {
  const k = process.env.ALCHEMY_API_KEY;
  if (!k) throw new ExplorerError("not_configured", "ALCHEMY_API_KEY is not set.");
  return k;
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  if (!res.ok) throw classifyUpstream(res.status, text);
  const json = JSON.parse(text) as { error?: { message?: string } } & T;
  if (json && typeof json === "object" && "error" in json && json.error) {
    throw classifyUpstream(res.status, json.error.message ?? JSON.stringify(json.error));
  }
  return json;
}

export function dataApi<T>(path: string, body: unknown): Promise<T> {
  return request<T>(`https://api.g.alchemy.com/data/v1/${key()}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function pricesApi<T>(path: string, body: unknown): Promise<T> {
  return request<T>(`https://api.g.alchemy.com/prices/v1/${key()}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function rpc<T>(alchemyNetwork: string, method: string, params: unknown[]): Promise<T> {
  const json = await request<{ result: T }>(`https://${alchemyNetwork}.g.alchemy.com/v2/${key()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return json.result;
}
