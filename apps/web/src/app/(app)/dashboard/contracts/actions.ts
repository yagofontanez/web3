"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { createPublicClient, getAddress, http, isAddress, isHash, type Abi } from "viem";
import { hardhat } from "viem/chains";
import { z } from "zod";
import { db, schema } from "@w3s/db";
import { compile, fetchVerifiedContract, formatValue, functionsOf, generate, parseArgs, submitVerification, validateOptions, verificationStatus, type TemplateOptions } from "@w3s/contracts";
import { getChain, rpcUrl } from "@w3s/chains";
import { audit } from "@/lib/audit";
import { requireOrg } from "@/lib/dal";
import { LOCAL_CHAIN_ID, studioNetwork } from "@/lib/studio";

type Result<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string; details?: { message: string; line: number | null }[] };

function client(chainId: number) {
  if (chainId === LOCAL_CHAIN_ID && process.env.STUDIO_LOCAL_RPC) return createPublicClient({ chain: hardhat, transport: http(process.env.STUDIO_LOCAL_RPC) });
  const chain = getChain(chainId);
  if (!chain) throw new Error("Unsupported chain");
  return createPublicClient({ chain, transport: http(rpcUrl(chainId)) });
}

async function owned(id: string) {
  const ctx = await requireOrg();
  const [row] = await db.select().from(schema.studioContract).where(and(eq(schema.studioContract.id, id), eq(schema.studioContract.organizationId, ctx.org.id))).limit(1);
  return { ...ctx, row };
}

const draftInput = z.union([
  z.object({ mode: z.literal("template"), options: z.record(z.string(), z.unknown()) }),
  z.object({ mode: z.literal("custom"), name: z.string().trim().min(2).max(60), source: z.string().min(20).max(200_000) }),
]);

export async function createDraft(input: z.input<typeof draftInput>): Promise<Result<{ id: string }>> {
  const { org, user, can } = await requireOrg();
  if (!can({ contract: ["create"] })) return { ok: false, error: "Your role can't create contracts." };
  const parsed = draftInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That request didn't look right. Reload and try again." };

  let name: string;
  let source: string;
  let preferred: string | undefined;
  let template: TemplateOptions | null = null;
  if (parsed.data.mode === "template") {
    const o = parsed.data.options as TemplateOptions;
    if (o.kind !== "erc20" && o.kind !== "erc721") return { ok: false, error: "Unknown template." };
    const problem = validateOptions(o);
    if (problem) return { ok: false, error: problem };
    const g = generate(o);
    template = o;
    name = o.name;
    source = g.source;
    preferred = g.contractName;
  } else {
    name = parsed.data.name;
    source = parsed.data.source;
  }

  const result = compile(source, preferred);
  if (!result.ok) return { ok: false, error: "The contract doesn't compile yet.", details: result.messages.filter((m) => m.severity === "error").slice(0, 8) };

  const [row] = await db
    .insert(schema.studioContract)
    .values({
      organizationId: org.id,
      name,
      origin: template ? "template" : "custom",
      template,
      contractName: result.contractName,
      source,
      standardJson: result.standardJson,
      compilerVersion: result.compilerVersion,
      abi: result.abi,
      bytecode: result.bytecode,
      createdBy: user.id,
    })
    .returning({ id: schema.studioContract.id });
  await audit({ organizationId: org.id, actorId: user.id, action: "contract.compiled", targetType: "contract", targetId: row!.id, metadata: { name } });
  return { ok: true, data: { id: row!.id } };
}

export async function compileCheck(source: string): Promise<Result<{ contractName: string; warnings: number }>> {
  const { can } = await requireOrg();
  if (!can({ contract: ["create"] })) return { ok: false, error: "Your role can't compile contracts." };
  const r = compile(source);
  if (!r.ok) return { ok: false, error: "The contract doesn't compile yet.", details: r.messages.filter((m) => m.severity === "error").slice(0, 8) };
  return { ok: true, data: { contractName: r.contractName, warnings: r.messages.filter((m) => m.severity === "warning").length } };
}

export async function importContract(input: { network: string; address: string; name?: string }): Promise<Result<{ id: string }>> {
  const { org, user, can } = await requireOrg();
  if (!can({ contract: ["create"] })) return { ok: false, error: "Your role can't import contracts." };
  const net = studioNetwork(input.network);
  if (!net) return { ok: false, error: "Pick Sepolia or Base Sepolia." };
  if (!isAddress(input.address.trim(), { strict: false })) return { ok: false, error: "Enter a 0x contract address." };
  const address = getAddress(input.address.trim());
  const code = await client(net.chainId).getCode({ address }).catch(() => undefined);
  if (!code || code === "0x") return { ok: false, error: `There's no contract at that address on ${net.name}.` };
  if (net.slug === "local") return { ok: false, error: "Importing needs a block explorer, so it only works on Sepolia and Base Sepolia." };
  const found = await fetchVerifiedContract(net.chainId, address);
  if (!found.ok) return { ok: false, error: found.error };
  const [row] = await db
    .insert(schema.studioContract)
    .values({
      organizationId: org.id,
      name: input.name?.trim() || found.name,
      origin: "imported",
      contractName: found.name,
      compilerVersion: found.compilerVersion,
      abi: found.abi,
      status: "deployed",
      network: net.slug,
      chainId: net.chainId,
      address,
      verification: "verified",
      verificationMessage: found.proxyName ? `Proxy ${found.proxyName}, implementation ${found.implementation}` : null,
      createdBy: user.id,
    })
    .returning({ id: schema.studioContract.id });
  await audit({ organizationId: org.id, actorId: user.id, action: "contract.imported", targetType: "contract", targetId: row!.id, metadata: { name: found.name, network: net.slug } });
  return { ok: true, data: { id: row!.id } };
}

export async function recordDeployment(id: string, input: { network: string; txHash: string; deployer: string }): Promise<Result> {
  const { org, user, can, row } = await owned(id);
  if (!can({ contract: ["deploy"] })) return { ok: false, error: "Your role can't deploy contracts." };
  if (!row) return { ok: false, error: "That contract no longer exists." };
  const net = studioNetwork(input.network);
  if (!net || !isHash(input.txHash) || !isAddress(input.deployer)) return { ok: false, error: "Invalid deployment details." };
  await db
    .update(schema.studioContract)
    .set({ status: "deploying", network: net.slug, chainId: net.chainId, deployTxHash: input.txHash, deployer: getAddress(input.deployer), deployError: null, updatedAt: new Date() })
    .where(eq(schema.studioContract.id, row.id));
  await audit({ organizationId: org.id, actorId: user.id, action: "contract.deploy_submitted", targetType: "contract", targetId: row.id, metadata: { name: row.name, network: net.slug, txHash: input.txHash } });
  return { ok: true };
}

export async function confirmDeployment(id: string): Promise<Result<{ status: "deploying" | "deployed" | "failed"; address?: string }>> {
  const { org, user, row } = await owned(id);
  if (!row) return { ok: false, error: "That contract no longer exists." };
  if (row.status === "deployed") return { ok: true, data: { status: "deployed", address: row.address ?? undefined } };
  if (!row.deployTxHash || !row.chainId) return { ok: false, error: "No deployment to confirm." };
  const c = client(row.chainId);
  const receipt = await c.getTransactionReceipt({ hash: row.deployTxHash as `0x${string}` }).catch(() => null);
  if (!receipt) return { ok: true, data: { status: "deploying" } };
  if (receipt.status !== "success" || !receipt.contractAddress) {
    await db.update(schema.studioContract).set({ status: "failed", deployError: "The deployment transaction reverted.", updatedAt: new Date() }).where(eq(schema.studioContract.id, row.id));
    return { ok: true, data: { status: "failed" } };
  }
  const tx = await c.getTransaction({ hash: row.deployTxHash as `0x${string}` });
  const args = row.bytecode && tx.input.startsWith(row.bytecode) ? `0x${tx.input.slice(row.bytecode.length)}` : "0x";
  await db
    .update(schema.studioContract)
    .set({ status: "deployed", address: getAddress(receipt.contractAddress), deployedAt: new Date(), constructorArgs: args, updatedAt: new Date() })
    .where(eq(schema.studioContract.id, row.id));
  await audit({ organizationId: org.id, actorId: user.id, action: "contract.deployed", targetType: "contract", targetId: row.id, metadata: { name: row.name, network: row.network, address: receipt.contractAddress } });
  refresh();
  return { ok: true, data: { status: "deployed", address: receipt.contractAddress } };
}

export async function readFunction(id: string, fn: string, values: string[]): Promise<Result<{ value: string }>> {
  const { row } = await owned(id);
  if (!row?.address || !row.chainId) return { ok: false, error: "Deploy the contract first." };
  const f = functionsOf(row.abi).reads.find((x) => `${x.name}(${x.inputs.map((i) => i.type).join(",")})` === fn);
  if (!f) return { ok: false, error: "Unknown function." };
  try {
    const args = parseArgs(f.inputs, values);
    const value = await client(row.chainId).readContract({ address: row.address as `0x${string}`, abi: [f] as Abi, functionName: f.name, args });
    return { ok: true, data: { value: formatValue(value) } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: (message.split("\n").find((l) => /reverted|Error:|must|valid|large|negative|exactly/i.test(l)) ?? message.split("\n")[0] ?? "Call failed").slice(0, 300) };
  }
}

export async function transactionStatus(network: string, hash: string): Promise<Result<{ status: "pending" | "success" | "reverted"; block?: number }>> {
  await requireOrg();
  const net = studioNetwork(network);
  if (!net || !isHash(hash)) return { ok: false, error: "Invalid transaction." };
  const receipt = await client(net.chainId).getTransactionReceipt({ hash }).catch(() => null);
  if (!receipt) return { ok: true, data: { status: "pending" } };
  return { ok: true, data: { status: receipt.status === "success" ? "success" : "reverted", block: Number(receipt.blockNumber) } };
}

export async function verifyContract(id: string): Promise<Result> {
  const { org, user, can, row } = await owned(id);
  if (!can({ contract: ["deploy"] })) return { ok: false, error: "Your role can't verify contracts." };
  if (!row?.address || !row.chainId || !row.standardJson || !row.compilerVersion) return { ok: false, error: "Only contracts compiled and deployed from the studio can be verified here." };
  if (row.chainId === LOCAL_CHAIN_ID) return { ok: false, error: "The local devnet has no block explorer to verify against." };
  const r = await submitVerification({
    chainId: row.chainId,
    address: row.address,
    standardJson: row.standardJson,
    contractName: row.contractName,
    compilerVersion: row.compilerVersion,
    constructorArgs: row.constructorArgs ?? "0x",
  });
  if (!r.ok) {
    await db.update(schema.studioContract).set({ verification: "failed", verificationMessage: r.error.slice(0, 500), updatedAt: new Date() }).where(eq(schema.studioContract.id, row.id));
    return { ok: false, error: r.error };
  }
  await db
    .update(schema.studioContract)
    .set({ verification: r.guid ? "pending" : "verified", verificationGuid: r.guid, verificationMessage: r.guid ? "Submitted, waiting for the explorer" : "Already verified", updatedAt: new Date() })
    .where(eq(schema.studioContract.id, row.id));
  await audit({ organizationId: org.id, actorId: user.id, action: "contract.verification_submitted", targetType: "contract", targetId: row.id, metadata: { name: row.name } });
  refresh();
  return { ok: true };
}

export async function refreshVerification(id: string): Promise<Result<{ state: string }>> {
  const { row } = await owned(id);
  if (!row?.verificationGuid || !row.chainId) return { ok: true, data: { state: row?.verification ?? "unverified" } };
  if (row.verification !== "pending") return { ok: true, data: { state: row.verification } };
  const s = await verificationStatus(row.chainId, row.verificationGuid);
  if (s.state !== "pending") {
    await db.update(schema.studioContract).set({ verification: s.state, verificationMessage: s.message.slice(0, 500), updatedAt: new Date() }).where(eq(schema.studioContract.id, row.id));
    refresh();
  }
  return { ok: true, data: { state: s.state } };
}

export async function deleteContract(id: string): Promise<Result> {
  const { org, user, can, row } = await owned(id);
  if (!can({ contract: ["delete"] })) return { ok: false, error: "Your role can't remove contracts." };
  if (!row) return { ok: false, error: "That contract was already removed." };
  await db.delete(schema.studioContract).where(eq(schema.studioContract.id, row.id));
  await audit({ organizationId: org.id, actorId: user.id, action: "contract.removed", targetType: "contract", targetId: row.id, metadata: { name: row.name } });
  return { ok: true };
}
