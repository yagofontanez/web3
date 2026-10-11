import { bigserial, index, integer, pgTable, smallint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    archivedAt: timestamp("archived_at"),
  },
  (t) => [index("project_org_idx").on(t.organizationId, t.createdAt)],
);

export const apiKey = pgTable(
  "api_key",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    hash: text("hash").notNull(),
    rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(120),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    revokedBy: text("revoked_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("api_key_hash_uq").on(t.hash), index("api_key_project_idx").on(t.projectId, t.createdAt)],
);

export const apiRequestLog = pgTable(
  "api_request_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: text("organization_id").notNull(),
    projectId: text("project_id").notNull(),
    apiKeyId: text("api_key_id").notNull(),
    method: text("method").notNull(),
    route: text("route").notNull(),
    path: text("path").notNull(),
    status: smallint("status").notNull(),
    durationMs: integer("duration_ms").notNull(),
    errorCode: text("error_code"),
    ip: text("ip"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("api_request_log_project_created_idx").on(t.projectId, t.createdAt),
    index("api_request_log_key_created_idx").on(t.apiKeyId, t.createdAt),
    index("api_request_log_created_idx").on(t.createdAt),
  ],
);
