import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export type TransferParams = {
  direction: "in" | "out" | "any";
  asset: "any" | "native" | `0x${string}`;
  minAmount: string | null;
};

export type EventParams = {
  signature: string;
};

export const monitor = pgTable(
  "monitor",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").$type<"transfer" | "event">().notNull(),
    network: text("network").notNull(),
    address: text("address").notNull(),
    params: jsonb("params").$type<TransferParams | EventParams>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastCheckedBlock: bigint("last_checked_block", { mode: "number" }),
    lastTriggeredAt: timestamp("last_triggered_at"),
    lastError: text("last_error"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("monitor_org_idx").on(t.organizationId, t.createdAt), index("monitor_enabled_network_idx").on(t.enabled, t.network)],
);

export type TelegramConfig = { chatId: string; chatTitle: string; chatType: string };
export type WebhookConfig = { url: string; secretEncrypted: string; secretHint: string };

export const notificationChannel = pgTable(
  "notification_channel",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"telegram" | "webhook">().notNull(),
    name: text("name").notNull(),
    config: jsonb("config").$type<TelegramConfig | WebhookConfig>().notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    disabledAt: timestamp("disabled_at"),
  },
  (t) => [index("notification_channel_org_idx").on(t.organizationId)],
);

export const monitorChannel = pgTable(
  "monitor_channel",
  {
    monitorId: text("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => notificationChannel.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.monitorId, t.channelId] })],
);

export const telegramLink = pgTable("telegram_link", {
  code: text("code").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  channelId: text("channel_id"),
});

export type AlertPayload = {
  kind: "transfer" | "event";
  network: string;
  txHash: string;
  blockNumber: number;
  timestamp: string | null;
  address: string;
  direction?: "in" | "out" | "self";
  asset?: string | null;
  tokenAddress?: string | null;
  value?: string | null;
  from?: string | null;
  to?: string | null;
  event?: string;
  args?: Record<string, string>;
};

export const alert = pgTable(
  "alert",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    monitorId: text("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    dedupeKey: text("dedupe_key").notNull(),
    title: text("title").notNull(),
    payload: jsonb("payload").$type<AlertPayload>().notNull(),
    test: boolean("test").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("alert_monitor_dedupe_uq").on(t.monitorId, t.dedupeKey), index("alert_org_created_idx").on(t.organizationId, t.createdAt)],
);

export const delivery = pgTable(
  "delivery",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    alertId: text("alert_id")
      .notNull()
      .references(() => alert.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => notificationChannel.id, { onDelete: "cascade" }),
    status: text("status").$type<"pending" | "delivered" | "failed">().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastStatusCode: smallint("last_status_code"),
    lastError: text("last_error"),
    lastAttemptAt: timestamp("last_attempt_at"),
    deliveredAt: timestamp("delivered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("delivery_alert_channel_uq").on(t.alertId, t.channelId), index("delivery_status_idx").on(t.status)],
);

export type AlertPayloadType = AlertPayload;
