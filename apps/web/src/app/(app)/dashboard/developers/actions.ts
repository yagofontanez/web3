"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@w3s/db";
import { generateApiKey } from "@w3s/shared/api-keys";
import { audit } from "@/lib/audit";
import { requireOrg } from "@/lib/dal";
import { redis } from "@/lib/redis";

export type ActionResult<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

const projectInput = z.object({
  name: z.string().trim().min(2, "Name needs at least 2 characters").max(48, "Keep the name under 48 characters"),
  description: z.string().trim().max(200).optional(),
});

export async function createProject(input: z.input<typeof projectInput>): Promise<ActionResult<{ id: string }>> {
  const { org, user, can } = await requireOrg();
  if (!can({ project: ["create"] })) return { ok: false, error: "Your role can't create projects." };
  const parsed = projectInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const [row] = await db
    .insert(schema.project)
    .values({ organizationId: org.id, name: parsed.data.name, description: parsed.data.description || null, createdBy: user.id })
    .returning({ id: schema.project.id });
  await audit({ organizationId: org.id, actorId: user.id, action: "project.created", targetType: "project", targetId: row!.id, metadata: { name: parsed.data.name } });
  refresh();
  return { ok: true, data: { id: row!.id } };
}

export async function archiveProject(projectId: string): Promise<ActionResult> {
  const { org, user, can } = await requireOrg();
  if (!can({ project: ["delete"] })) return { ok: false, error: "Your role can't archive projects." };
  const [row] = await db
    .update(schema.project)
    .set({ archivedAt: new Date() })
    .where(and(eq(schema.project.id, projectId), eq(schema.project.organizationId, org.id), isNull(schema.project.archivedAt)))
    .returning({ name: schema.project.name });
  if (!row) return { ok: false, error: "That project no longer exists." };
  const keys = await db
    .update(schema.apiKey)
    .set({ revokedAt: new Date(), revokedBy: user.id })
    .where(and(eq(schema.apiKey.projectId, projectId), isNull(schema.apiKey.revokedAt)))
    .returning({ hash: schema.apiKey.hash });
  await Promise.all(keys.map((k) => redis().del(`w3s:apikey:${k.hash}`).catch(() => 0)));
  await audit({ organizationId: org.id, actorId: user.id, action: "project.archived", targetType: "project", targetId: projectId, metadata: { name: row.name, keysRevoked: keys.length } });
  return { ok: true };
}

const keyInput = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2, "Name needs at least 2 characters").max(48, "Keep the name under 48 characters"),
  rateLimitPerMinute: z.number().int().min(10).max(1200),
});

export async function createApiKey(input: z.input<typeof keyInput>): Promise<ActionResult<{ key: string; prefix: string }>> {
  const { org, user, can } = await requireOrg();
  if (!can({ apiKey: ["create"] })) return { ok: false, error: "Your role can't create API keys." };
  const parsed = keyInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const [project] = await db
    .select({ id: schema.project.id, name: schema.project.name })
    .from(schema.project)
    .where(and(eq(schema.project.id, parsed.data.projectId), eq(schema.project.organizationId, org.id), isNull(schema.project.archivedAt)))
    .limit(1);
  if (!project) return { ok: false, error: "That project no longer exists." };

  const { key, prefix, hash } = generateApiKey();
  const [row] = await db
    .insert(schema.apiKey)
    .values({
      organizationId: org.id,
      projectId: project.id,
      name: parsed.data.name,
      prefix,
      hash,
      rateLimitPerMinute: parsed.data.rateLimitPerMinute,
      createdBy: user.id,
    })
    .returning({ id: schema.apiKey.id });
  await audit({
    organizationId: org.id,
    actorId: user.id,
    action: "api_key.created",
    targetType: "api_key",
    targetId: row!.id,
    metadata: { name: parsed.data.name, prefix, project: project.name },
  });
  refresh();
  return { ok: true, data: { key, prefix } };
}

export async function revokeApiKey(keyId: string): Promise<ActionResult> {
  const { org, user, can } = await requireOrg();
  if (!can({ apiKey: ["revoke"] })) return { ok: false, error: "Your role can't revoke API keys." };
  const [row] = await db
    .update(schema.apiKey)
    .set({ revokedAt: new Date(), revokedBy: user.id })
    .where(and(eq(schema.apiKey.id, keyId), eq(schema.apiKey.organizationId, org.id), isNull(schema.apiKey.revokedAt)))
    .returning({ hash: schema.apiKey.hash, name: schema.apiKey.name, prefix: schema.apiKey.prefix });
  if (!row) return { ok: false, error: "That key was already revoked." };
  await redis().del(`w3s:apikey:${row.hash}`).catch(() => 0);
  await audit({ organizationId: org.id, actorId: user.id, action: "api_key.revoked", targetType: "api_key", targetId: keyId, metadata: { name: row.name, prefix: row.prefix } });
  refresh();
  return { ok: true };
}
