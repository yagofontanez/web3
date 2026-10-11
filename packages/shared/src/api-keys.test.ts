import { describe, expect, it } from "vitest";
import { API_KEY_PREFIX, generateApiKey, hashApiKey, looksLikeApiKey, safeEqualHex } from "./api-keys";

const PEPPER = "x".repeat(40);

describe("api keys", () => {
  it("generates keys with the expected shape and a display prefix", () => {
    const { key, prefix, hash } = generateApiKey(PEPPER);
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(key).toHaveLength(API_KEY_PREFIX.length + 32);
    expect(looksLikeApiKey(key)).toBe(true);
    expect(key.startsWith(prefix)).toBe(true);
    expect(prefix).toHaveLength(API_KEY_PREFIX.length + 6);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never repeats and never stores the key itself", () => {
    const a = generateApiKey(PEPPER);
    const b = generateApiKey(PEPPER);
    expect(a.key).not.toBe(b.key);
    expect(a.hash).not.toContain(a.key);
  });

  it("hashes deterministically per pepper", () => {
    const { key, hash } = generateApiKey(PEPPER);
    expect(hashApiKey(key, PEPPER)).toBe(hash);
    expect(hashApiKey(key, "y".repeat(40))).not.toBe(hash);
  });

  it("rejects malformed keys and short peppers", () => {
    expect(looksLikeApiKey("w3s_live_short")).toBe(false);
    expect(looksLikeApiKey(`sk_live_${"a".repeat(32)}`)).toBe(false);
    expect(() => hashApiKey("anything", "short")).toThrow();
  });

  it("compares hashes in constant time", () => {
    const h = hashApiKey("k", PEPPER);
    expect(safeEqualHex(h, h)).toBe(true);
    expect(safeEqualHex(h, hashApiKey("j", PEPPER))).toBe(false);
  });
});
