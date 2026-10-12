import { describe, expect, it } from "vitest";
import { createPublicClient, createWalletClient, getContract, http, parseEther, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { compile } from "./compile";
import { DEFAULT_ERC20, DEFAULT_ERC721, generate, type TemplateOptions } from "./templates";

const RPC = process.env.LOCAL_EVM_URL;
const OWNER = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const OTHER = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

const pub = RPC ? createPublicClient({ chain: hardhat, transport: http(RPC) }) : null;
const wallet = (account = OWNER) => createWalletClient({ account, chain: hardhat, transport: http(RPC) });

async function deploy(options: TemplateOptions) {
  const g = generate(options);
  const c = compile(g.source, g.contractName);
  if (!c.ok) throw new Error(JSON.stringify(c.messages));
  const hash = await wallet().deployContract({ abi: c.abi as Abi, bytecode: c.bytecode, args: [OWNER.address] });
  const receipt = await pub!.waitForTransactionReceipt({ hash });
  expect(receipt.status).toBe("success");
  const address = receipt.contractAddress!;
  return {
    address,
    as: (account = OWNER) => getContract({ address, abi: c.abi as Abi, client: { public: pub!, wallet: wallet(account) } }),
  };
}

const mined = (hash: `0x${string}`) => pub!.waitForTransactionReceipt({ hash });

describe.skipIf(!RPC)("templates on a local EVM", () => {
  it("deploys an ERC-20 with premint, permit name, owner-only mint and burn", async () => {
    const t = await deploy(DEFAULT_ERC20);
    const c = t.as();
    expect(await c.read.name!()).toBe("Acme Points");
    expect(await c.read.symbol!()).toBe("ACME");
    expect(await c.read.totalSupply!()).toBe(parseEther("1000000"));
    expect(await c.read.balanceOf!([OWNER.address])).toBe(parseEther("1000000"));
    expect(typeof (await c.read.DOMAIN_SEPARATOR!())).toBe("string");

    await mined(await c.write.mint!([OTHER.address, parseEther("5")]));
    expect(await c.read.balanceOf!([OTHER.address])).toBe(parseEther("5"));
    await expect(t.as(OTHER).write.mint!([OTHER.address, 1n])).rejects.toThrow();

    await mined(await t.as(OTHER).write.burn!([parseEther("2")]));
    expect(await c.read.balanceOf!([OTHER.address])).toBe(parseEther("3"));
  });

  it("blocks transfers while an ERC-20 is paused", async () => {
    const t = await deploy({ ...DEFAULT_ERC20, pausable: true, mintable: false });
    const c = t.as();
    await mined(await c.write.transfer!([OTHER.address, 10n]));
    await mined(await c.write.pause!());
    await expect(c.write.transfer!([OTHER.address, 10n])).rejects.toThrow();
    await mined(await c.write.unpause!());
    await mined(await c.write.transfer!([OTHER.address, 10n]));
    expect(await c.read.balanceOf!([OTHER.address])).toBe(20n);
  });

  it("deploys an ERC-721 that mints sequential ids with the base URI", async () => {
    const t = await deploy({ ...DEFAULT_ERC721, baseUri: "ipfs://bafy/", burnable: true });
    const c = t.as();
    await mined(await c.write.safeMint!([OTHER.address]));
    await mined(await c.write.safeMint!([OTHER.address]));
    expect(await c.read.ownerOf!([1n])).toBe(OTHER.address);
    expect(await c.read.balanceOf!([OTHER.address])).toBe(2n);
    expect(await c.read.tokenURI!([1n])).toBe("ipfs://bafy/1");
    await expect(t.as(OTHER).write.safeMint!([OTHER.address])).rejects.toThrow();
    await mined(await t.as(OTHER).write.burn!([0n]));
    expect(await c.read.balanceOf!([OTHER.address])).toBe(1n);
  });
}, 60_000);
