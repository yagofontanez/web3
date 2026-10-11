import type { FastifyReply, FastifyRequest } from "fastify";
import { hashApiKey, looksLikeApiKey } from "@w3s/shared/api-keys";
import { unauthorized } from "../errors";
import type { KeyStore } from "../types";

export function extractKey(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const header = request.headers["x-api-key"];
  return typeof header === "string" ? header.trim() : null;
}

export function apiKeyAuth(keys: KeyStore, pepper: string) {
  return async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
    const key = extractKey(request);
    if (!key) throw unauthorized();
    if (!looksLikeApiKey(key)) throw unauthorized("That doesn't look like a Systema API key. Keys start with w3s_live_.");
    const record = await keys.findByHash(hashApiKey(key, pepper));
    if (!record) throw unauthorized("This API key doesn't exist. Check for typos or create a new one in the dashboard.");
    if (record.revoked) throw unauthorized("This API key was revoked. Create a new one in the dashboard.");
    request.apiKey = record;
  };
}
