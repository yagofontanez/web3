import { describe, expect, it } from "vitest";
import { constructorOf, formatValue, functionsOf, parseArgs, type AbiParam } from "./abi";
import { compile } from "./compile";
import { contractIdentifier, DEFAULT_ERC20, DEFAULT_ERC721, generate, validateOptions } from "./templates";

describe("templates", () => {
  it("builds safe contract identifiers from names", () => {
    expect(contractIdentifier("acme points")).toBe("AcmePoints");
    expect(contractIdentifier("1st Drop!")).toBe("C1stDrop");
    expect(contractIdentifier("   ")).toBe("MyContract");
  });

  it("rejects input that could break out of a Solidity string", () => {
    expect(validateOptions({ ...DEFAULT_ERC20, name: 'Evil"); selfdestruct(' })).toMatch(/quotes/);
    expect(validateOptions({ ...DEFAULT_ERC20, symbol: "AC ME" })).toMatch(/letters and numbers/);
    expect(validateOptions({ ...DEFAULT_ERC20, premint: "1.5" })).toMatch(/whole number/);
    expect(validateOptions({ ...DEFAULT_ERC20, premint: "0", mintable: false })).toMatch(/minting/);
    expect(validateOptions({ ...DEFAULT_ERC721, baseUri: "ipfs://a b" })).toMatch(/spaces/);
    expect(validateOptions(DEFAULT_ERC20)).toBeNull();
  });

  it("only imports the extensions that are switched on", () => {
    const plain = generate({ ...DEFAULT_ERC20, burnable: false, permit: false, pausable: false }).source;
    expect(plain).not.toContain("ERC20Burnable");
    expect(plain).not.toContain("_update");
    const paused = generate({ ...DEFAULT_ERC20, pausable: true }).source;
    expect(paused).toContain("override(ERC20, ERC20Pausable)");
  });
});

describe("compiler", () => {
  it("compiles templates and returns the chosen contract", () => {
    const g = generate(DEFAULT_ERC721);
    const r = compile(g.source, g.contractName);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.contractName).toBe("AcmePasses");
      expect(r.bytecode.startsWith("0x60")).toBe(true);
      expect(constructorOf(r.abi).map((i) => i.type)).toEqual(["address"]);
      expect(Object.keys(JSON.parse(r.standardJson).sources)).toContain("@openzeppelin/contracts/token/ERC721/ERC721.sol");
    }
  });

  it("reports syntax errors with line numbers", () => {
    const r = compile('// SPDX-License-Identifier: MIT\npragma solidity ^0.8.27;\ncontract A {\n  function f() public { uint x = ; }\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.messages[0]).toMatchObject({ severity: "error", line: 4 });
  });

  it("refuses imports outside OpenZeppelin and abstract-only sources", () => {
    const outside = compile('pragma solidity ^0.8.27;\nimport "../../../../etc/passwd";\ncontract A {}');
    expect(outside.ok).toBe(false);
    const abstract = compile("// SPDX-License-Identifier: MIT\npragma solidity ^0.8.27;\ninterface I { function f() external; }");
    expect(abstract.ok).toBe(false);
  });
});

describe("abi forms", () => {
  const p = (type: string, name = "x", components?: AbiParam[]): AbiParam => ({ type, name, components });

  it("splits reads from writes", () => {
    const g = generate(DEFAULT_ERC20);
    const r = compile(g.source, g.contractName);
    if (!r.ok) throw new Error("compile failed");
    const { reads, writes } = functionsOf(r.abi);
    expect(reads.map((f) => f.name)).toContain("balanceOf");
    expect(writes.map((f) => f.name)).toEqual(expect.arrayContaining(["mint", "transfer", "burn"]));
    expect(reads.find((f) => f.name === "mint")).toBeUndefined();
  });

  it("coerces form strings into ABI values with clear errors", () => {
    expect(parseArgs([p("uint256"), p("bool"), p("address")], ["1000", "true", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"])).toEqual([1000n, true, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]);
    expect(parseArgs([p("uint256[]")], ['["1","2"]'])).toEqual([[1n, 2n]]);
    expect(parseArgs([p("tuple", "t", [p("address", "to"), p("uint8", "n")])], ['{"to":"0x0000000000000000000000000000000000000001","n":3}'])).toEqual([{ to: "0x0000000000000000000000000000000000000001", n: 3n }]);
    expect(() => parseArgs([p("uint256", "amount")], ["1.5"])).toThrow(/amount must be a whole number/);
    expect(() => parseArgs([p("uint8", "n")], ["256"])).toThrow(/too large/);
    expect(() => parseArgs([p("uint256", "n")], ["-1"])).toThrow(/negative/);
    expect(() => parseArgs([p("address", "to")], ["0x123"])).toThrow(/40 hex/);
    expect(() => parseArgs([p("bytes32", "id")], ["0x12"])).toThrow(/32 bytes/);
    expect(() => parseArgs([p("uint256[]", "ids")], ["[1,"])).toThrow(/valid JSON/);
  });

  it("formats outputs including bigints", () => {
    expect(formatValue(10n ** 24n)).toBe("1000000000000000000000000");
    expect(formatValue([1n, "a"])).toBe('["1","a"]');
  });
});
