import { db, schema } from "@w3s/db";

export type AuditEntry = {
  organizationId: string | null;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

export async function audit(entry: AuditEntry) {
  try {
    await db.insert(schema.auditLog).values(entry);
  } catch (err) {
    console.error("[audit] failed to write entry", entry.action, err);
  }
}
