import { describe, expect, it } from "vitest";
import { BURST_SAMPLE, BURST_THRESHOLD, chunks, MAX_RANGE, mergeTransfers, nextRange, throttle, transferMatches, transferToAlert, type RawTransfer } from "./match";

const ME = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const t = (over: Partial<RawTransfer>): RawTransfer => ({
  uniqueId: "a",
  hash: "0xh",
  blockNum: "0x10",
  from: "0x1111111111111111111111111111111111111111",
  to: ME.toLowerCase(),
  value: 10,
  asset: "ETH",
  category: "external",
  rawContract: { address: null },
  ...over,
});

describe("transfer matching", () => {
  it("filters by asset kind and token contract", () => {
    const usdc = t({ category: "erc20", asset: "USDC", rawContract: { address: USDC.toLowerCase() } });
    expect(transferMatches({ direction: "any", asset: "native", minAmount: null }, t({}))).toBe(true);
    expect(transferMatches({ direction: "any", asset: "native", minAmount: null }, usdc)).toBe(false);
    expect(transferMatches({ direction: "any", asset: USDC, minAmount: null }, usdc)).toBe(true);
    expect(transferMatches({ direction: "any", asset: USDC, minAmount: null }, t({}))).toBe(false);
    expect(transferMatches({ direction: "any", asset: "any", minAmount: null }, usdc)).toBe(true);
  });

  it("applies the minimum amount, treating unknown values as not matching", () => {
    const p = { direction: "any" as const, asset: "any" as const, minAmount: "100" };
    expect(transferMatches(p, t({ value: 100 }))).toBe(true);
    expect(transferMatches(p, t({ value: 99.99 }))).toBe(false);
    expect(transferMatches(p, t({ value: null }))).toBe(false);
    expect(transferMatches({ ...p, minAmount: null }, t({ value: null }))).toBe(true);
  });

  it("builds alerts with direction and a stable dedupe key", () => {
    const incoming = transferToAlert(ME, "base", t({ uniqueId: "0xh:log:3" }));
    expect(incoming.dedupeKey).toBe("0xh:log:3");
    expect(incoming.payload).toMatchObject({ direction: "in", blockNumber: 16, value: "10", network: "base" });
    expect(transferToAlert(ME, "base", t({ from: ME.toLowerCase(), to: "0x2222222222222222222222222222222222222222" })).payload.direction).toBe("out");
  });

  it("merges both directions without duplicates, oldest first", () => {
    const merged = mergeTransfers([t({ uniqueId: "x", blockNum: "0x20" }), t({ uniqueId: "y", blockNum: "0x10" })], [t({ uniqueId: "x", blockNum: "0x20" })]);
    expect(merged.map((m) => m.uniqueId)).toEqual(["y", "x"]);
  });
});

describe("block ranges", () => {
  it("starts from the next block, caps the range and waits when caught up", () => {
    expect(nextRange(null, 100)).toBeNull();
    expect(nextRange(100, 100)).toBeNull();
    expect(nextRange(100, 105)).toEqual({ from: 101, to: 105 });
    expect(nextRange(100, 100_000)).toEqual({ from: 101, to: 100 + MAX_RANGE });
  });
});

import { parseStart } from "../telegram-parse";

describe("telegram /start parsing", () => {
  it("accepts private and group forms for this bot only", () => {
    expect(parseStart("/start abcDEF123_-x", "yago_systema_bot")).toBe("abcDEF123_-x");
    expect(parseStart("/start@yago_systema_bot abcDEF123", "yago_systema_bot")).toBe("abcDEF123");
    expect(parseStart("/start@other_bot abcDEF123", "yago_systema_bot")).toBeNull();
    expect(parseStart("/start", "yago_systema_bot")).toBeNull();
    expect(parseStart("hello", "yago_systema_bot")).toBeNull();
    expect(parseStart("/start short", "yago_systema_bot")).toBeNull();
  });
});

describe("flood protection and log windows", () => {
  it("sends everything under the burst threshold and samples above it", () => {
    const small = Array.from({ length: BURST_THRESHOLD }, (_, i) => i);
    expect(throttle(small)).toEqual({ send: small, suppressed: 0 });
    const big = Array.from({ length: 300 }, (_, i) => i);
    const t = throttle(big);
    expect(t.send).toEqual(big.slice(0, BURST_SAMPLE));
    expect(t.suppressed).toBe(300 - BURST_SAMPLE);
  });

  it("splits block ranges into provider-sized windows without gaps or overlap", () => {
    expect(chunks(101, 125, 10)).toEqual([
      { from: 101, to: 110 },
      { from: 111, to: 120 },
      { from: 121, to: 125 },
    ]);
    expect(chunks(5, 5, 10)).toEqual([{ from: 5, to: 5 }]);
    const w = chunks(1, 300, 10);
    expect(w).toHaveLength(30);
    expect(w.every((x, i) => i === 0 || x.from === w[i - 1]!.to + 1)).toBe(true);
  });

  it("uses a smaller range for event monitors when asked", () => {
    expect(nextRange(100, 100_000, 300)).toEqual({ from: 101, to: 400 });
  });
});
