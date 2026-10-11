import { describe, expect, it } from "vitest";
import { mergeActivity, toActivity, type ActivityItem } from "./activity";
import { decodeCursor, encodeCursor } from "./format";
import { networkBySlug } from "./networks";
import { parseNft } from "./nfts";
import { parseToken, sortHoldings } from "./portfolio";
import { looksLikeEns } from "./resolve";

const eth = networkBySlug("ethereum")!;
const me = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

describe("portfolio parsing", () => {
  it("parses native balance with price into USD value", () => {
    const h = parseToken(eth, {
      tokenAddress: null,
      tokenBalance: "0x" + (2n * 10n ** 18n).toString(16),
      tokenPrices: [{ currency: "usd", value: "2500" }],
    })!;
    expect(h.symbol).toBe("ETH");
    expect(h.balance).toBe("2");
    expect(h.valueUsd).toBe(5000);
  });

  it("drops zero balances and tokens without decimals", () => {
    expect(parseToken(eth, { tokenAddress: "0x1", tokenBalance: "0x0" })).toBeNull();
    expect(
      parseToken(eth, {
        tokenAddress: "0x1",
        tokenBalance: "0x10",
        tokenMetadata: { symbol: "X", decimals: null, name: null, logo: null },
      }),
    ).toBeNull();
  });

  it("treats tokens without a positive price as unpriced", () => {
    const h = parseToken(eth, {
      tokenAddress: "0xabc",
      tokenBalance: "0x0de0b6b3a7640000",
      tokenMetadata: { symbol: "SPAM", decimals: 18, name: "Spam", logo: null },
      tokenPrices: [{ currency: "usd", value: "0" }],
    })!;
    expect(h.priceUsd).toBeNull();
    expect(h.valueUsd).toBeNull();
  });

  it("sorts native first, then by USD value, unpriced last", () => {
    const base = { network: "ethereum", name: "", logo: null, decimals: 18, balance: "1", priceUsd: null };
    const list = [
      { ...base, contract: "0xa", symbol: "A", valueUsd: null },
      { ...base, contract: "0xb", symbol: "B", valueUsd: 10 },
      { ...base, contract: null, symbol: "ETH", valueUsd: 1 },
      { ...base, contract: "0xc", symbol: "C", valueUsd: 500 },
    ].sort(sortHoldings);
    expect(list.map((h) => h.symbol)).toEqual(["ETH", "C", "B", "A"]);
  });
});

describe("activity", () => {
  const raw = (over: Partial<Parameters<typeof toActivity>[1]>) => ({
    uniqueId: "u1",
    hash: "0xh",
    blockNum: "0x10",
    from: "0xother",
    to: me.toLowerCase(),
    value: 1,
    asset: "ETH",
    category: "external",
    erc721TokenId: null,
    tokenId: null,
    rawContract: { address: null },
    ...over,
  });

  it("derives direction and counterparty", () => {
    const incoming = toActivity(me, raw({}));
    expect(incoming.direction).toBe("in");
    expect(incoming.counterparty).toBe("0xother");
    const outgoing = toActivity(me, raw({ from: me.toLowerCase(), to: "0xdest" }));
    expect(outgoing.direction).toBe("out");
    expect(outgoing.counterparty).toBe("0xdest");
  });

  it("merges both directions, dedupes self transfers and sorts newest first", () => {
    const a: ActivityItem[] = [toActivity(me, raw({ uniqueId: "x", blockNum: "0x5" }))];
    const b: ActivityItem[] = [
      toActivity(me, raw({ uniqueId: "x", blockNum: "0x5", from: me.toLowerCase(), to: "0xdest" })),
      toActivity(me, raw({ uniqueId: "y", blockNum: "0x9", from: me.toLowerCase(), to: "0xdest" })),
    ];
    const merged = mergeActivity(a, b);
    expect(merged.map((i) => i.id)).toEqual(["y", "x"]);
    expect(merged[1]!.direction).toBe("self");
  });

  it("marks native transfers as verified and erc20 as unverified until priced", () => {
    expect(toActivity(me, raw({})).verified).toBe(true);
    expect(toActivity(me, raw({ category: "erc20", rawContract: { address: "0xt" } })).verified).toBe(false);
  });
});

describe("helpers", () => {
  it("round-trips cursors and rejects garbage", () => {
    const c = encodeCursor({ in: "a", out: null });
    expect(decodeCursor(c)).toEqual({ in: "a", out: null });
    expect(decodeCursor("not-a-cursor")).toBeUndefined();
  });

  it("recognises ENS-like names", () => {
    expect(looksLikeEns("vitalik.eth")).toBe(true);
    expect(looksLikeEns("sub.name.eth")).toBe(true);
    expect(looksLikeEns("vitalik")).toBe(false);
    expect(looksLikeEns("0xabc.eth")).toBe(false);
  });

  it("builds NFT names when metadata is missing", () => {
    const n = parseNft(eth, {
      tokenId: "12345678901234567890",
      tokenType: "ERC721",
      name: null,
      contract: { address: "0xc", name: "Punks" },
    });
    expect(n.name).toBe("Punks #12345678…");
    expect(n.collection).toBe("Punks");
  });
});

import { decodeEvent, parseEventSignature } from "./events";

describe("contract events", () => {
  it("parses signatures with or without the event keyword and computes topic0", () => {
    const a = parseEventSignature("Transfer(address indexed from, address indexed to, uint256 value)");
    const b = parseEventSignature("event Transfer(address indexed from, address indexed to, uint256 value);");
    if ("error" in a || "error" in b) throw new Error("should parse");
    expect(a.topic0).toBe("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef");
    expect(a.canonical).toBe("Transfer(address,address,uint256)");
    expect(b.topic0).toBe(a.topic0);
  });

  it("explains bad input instead of throwing", () => {
    expect("error" in parseEventSignature("not an event")).toBe(true);
    expect("error" in parseEventSignature("")).toBe(true);
  });

  it("decodes indexed and data arguments into strings", () => {
    const parsed = parseEventSignature("OwnershipTransferred(address indexed previousOwner, address indexed newOwner)");
    if ("error" in parsed) throw new Error("should parse");
    const args = decodeEvent(parsed, {
      data: "0x",
      topics: [
        parsed.topic0,
        "0x0000000000000000000000001111111111111111111111111111111111111111",
        "0x0000000000000000000000002222222222222222222222222222222222222222",
      ],
    });
    expect(args).toEqual({ previousOwner: "0x1111111111111111111111111111111111111111", newOwner: "0x2222222222222222222222222222222222222222" });
  });
});
