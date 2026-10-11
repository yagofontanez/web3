"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { db, schema } from "@w3s/db";
import { audit } from "@/lib/audit";
import { requireOrg } from "@/lib/dal";

const saveInput = z.object({
  address: z.string().refine((a) => isAddress(a, { strict: false }), "Not a valid address"),
  label: z.string().trim().min(1, "Give it a label").max(48, "Keep the label under 48 characters"),
  ensName: z.string().max(255).nullable().optional(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveAddress(input: z.input<typeof saveInput>): Promise<ActionResult> {
  const { org, user, can } = await requireOrg();
  if (!can({ address: ["create"] })) return { ok: false, error: "Your role can't save addresses." };
  const parsed = saveInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const address = getAddress(parsed.data.address);
  const [row] = await db
    .insert(schema.savedAddress)
    .values({ organizationId: org.id, address, label: parsed.data.label, ensName: parsed.data.ensName ?? null, createdBy: user.id })
    .onConflictDoUpdate({
      target: [schema.savedAddress.organizationId, schema.savedAddress.address],
      set: { label: parsed.data.label },
    })
    .returning({ id: schema.savedAddress.id });

  await audit({
    organizationId: org.id,
    actorId: user.id,
    action: "address.saved",
    targetType: "saved_address",
    targetId: row?.id,
    metadata: { address, label: parsed.data.label },
  });
  refresh();
  return { ok: true };
}

export async function removeAddress(id: string): Promise<ActionResult> {
  const { org, user, can } = await requireOrg();
  if (!can({ address: ["delete"] })) return { ok: false, error: "Your role can't remove saved addresses." };

  const [row] = await db
    .delete(schema.savedAddress)
    .where(and(eq(schema.savedAddress.id, id), eq(schema.savedAddress.organizationId, org.id)))
    .returning({ address: schema.savedAddress.address, label: schema.savedAddress.label });
  if (!row) return { ok: false, error: "That address was already removed." };

  await audit({
    organizationId: org.id,
    actorId: user.id,
    action: "address.removed",
    targetType: "saved_address",
    targetId: id,
    metadata: { address: row.address, label: row.label },
  });
  refresh();
  return { ok: true };
}
