import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const API_KEY_PREFIX = "w3s_live_";
const SECRET_LENGTH = 32;
const DISPLAY_LENGTH = API_KEY_PREFIX.length + 6;
const KEY_PATTERN = new RegExp(`^${API_KEY_PREFIX}[0-9A-Za-z]{${SECRET_LENGTH}}$`);

function pepper(explicit?: string) {
  const value = explicit ?? process.env.API_KEY_PEPPER;
  if (!value || value.length < 32) throw new Error("API_KEY_PEPPER must be set to at least 32 characters");
  return value;
}

function randomSecret(length: number) {
  const out: string[] = [];
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < 248 && out.length < length) out.push(ALPHABET[byte % 62]!);
    }
  }
  return out.join("");
}

export function looksLikeApiKey(value: string) {
  return KEY_PATTERN.test(value);
}

export function hashApiKey(key: string, secret?: string) {
  return createHmac("sha256", pepper(secret)).update(key).digest("hex");
}

export function generateApiKey(secret?: string) {
  const key = `${API_KEY_PREFIX}${randomSecret(SECRET_LENGTH)}`;
  return { key, prefix: key.slice(0, DISPLAY_LENGTH), hash: hashApiKey(key, secret) };
}

export function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}
