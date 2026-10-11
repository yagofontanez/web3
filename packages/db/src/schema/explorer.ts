import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const savedAddress = pgTable(
  "saved_address",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    label: text("label").notNull(),
    ensName: text("ens_name"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("saved_address_org_address_uq").on(t.organizationId, t.address),
    index("saved_address_org_created_idx").on(t.organizationId, t.createdAt),
  ],
);
