import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const studioContract = pgTable(
  "studio_contract",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    origin: text("origin").$type<"template" | "custom" | "imported">().notNull(),
    template: jsonb("template").$type<Record<string, unknown> | null>(),
    contractName: text("contract_name").notNull(),
    source: text("source"),
    standardJson: text("standard_json"),
    compilerVersion: text("compiler_version"),
    abi: jsonb("abi").$type<unknown[]>().notNull(),
    bytecode: text("bytecode"),
    status: text("status").$type<"draft" | "deploying" | "deployed" | "failed">().notNull().default("draft"),
    network: text("network"),
    chainId: integer("chain_id"),
    address: text("address"),
    deployTxHash: text("deploy_tx_hash"),
    deployer: text("deployer"),
    constructorArgs: text("constructor_args"),
    deployedAt: timestamp("deployed_at"),
    deployError: text("deploy_error"),
    verification: text("verification").$type<"unverified" | "pending" | "verified" | "failed">().notNull().default("unverified"),
    verificationGuid: text("verification_guid"),
    verificationMessage: text("verification_message"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("studio_contract_org_idx").on(t.organizationId, t.createdAt)],
);
