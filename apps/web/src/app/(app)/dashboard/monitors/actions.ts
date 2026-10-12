"use server";

import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db, schema } from "@w3s/db";
import type { AlertPayload, TelegramConfig, WebhookConfig } from "@w3s/db/schema";
import { networkBySlug, normalizeAddress, parseEventSignature, resolveQuery } from "@w3s/explorer";
import {
  alertTitle,
  checkWebhookUrl,
  decryptSecret,
  encryptSecret,
  generateWebhookSecret,
  sendTelegram,
  sendWebhook,
  telegramHtml,
  webhookBody,
  type SendResult,
} from "@w3s/notify";
import { audit } from "@/lib/audit";
import { activeMonitorCount, getPlan } from "@/lib/billing";
import { requireOrg } from "@/lib/dal";

type Result<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

async function monitorLimitError(organizationId: string) {
  const plan = await getPlan(organizationId);
  if (!Number.isFinite(plan.limits.monitors)) return null;
  if ((await activeMonitorCount(organizationId)) < plan.limits.monitors) return null;
  return `The ${plan.name} plan includes ${plan.limits.monitors} active monitors. Pause one or upgrade in Settings → Billing.`;
}

const monitorInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("transfer"),
    name: z.string().trim().min(2, "Give the monitor a name").max(60),
    network: z.string(),
    address: z.string().trim().min(3, "Enter the address to watch"),
    direction: z.enum(["in", "out", "any"]),
    asset: z.string().trim(),
    minAmount: z.string().trim().max(40).optional(),
    channelIds: z.array(z.string()).max(20),
  }),
  z.object({
    kind: z.literal("event"),
    name: z.string().trim().min(2, "Give the monitor a name").max(60),
    network: z.string(),
    address: z.string().trim().min(3, "Enter the contract address"),
    signature: z.string().trim().min(3, "Enter the event signature").max(300),
    channelIds: z.array(z.string()).max(20),
  }),
]);

export type MonitorInput = z.input<typeof monitorInput>;

async function normalize(orgId: string, input: MonitorInput) {
  const parsed = monitorInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" } as const;
  const v = parsed.data;
  if (!networkBySlug(v.network)) return { error: "Pick a network." } as const;

  let address = normalizeAddress(v.address);
  if (!address) {
    const r = await resolveQuery(v.address);
    if (!r.ok) return { error: r.reason === "not_found" ? `${v.address} doesn't resolve to an address.` : "Enter a 0x address or an ENS name." } as const;
    address = r.address;
  }

  let params: schema.TransferParams | schema.EventParams;
  if (v.kind === "transfer") {
    const asset = v.asset === "any" || v.asset === "native" ? v.asset : normalizeAddress(v.asset);
    if (!asset) return { error: "The token must be a contract address, or choose Any asset or Native coin." } as const;
    const min = v.minAmount ? Number(v.minAmount) : null;
    if (min !== null && (!Number.isFinite(min) || min < 0)) return { error: "Minimum amount must be a positive number." } as const;
    params = { direction: v.direction, asset, minAmount: min === null ? null : String(min) };
  } else {
    const ev = parseEventSignature(v.signature);
    if ("error" in ev) return { error: ev.error } as const;
    params = { signature: v.signature.trim().replace(/^event\s+/, "").replace(/;$/, "") };
  }

  const owned = v.channelIds.length
    ? await db
        .select({ id: schema.notificationChannel.id })
        .from(schema.notificationChannel)
        .where(and(eq(schema.notificationChannel.organizationId, orgId), isNull(schema.notificationChannel.disabledAt)))
    : [];
  const channelIds = v.channelIds.filter((id) => owned.some((o) => o.id === id));
  return { value: { name: v.name, kind: v.kind, network: v.network, address, params, channelIds } } as const;
}

export async function createMonitor(input: MonitorInput): Promise<Result<{ id: string }>> {
  const { org, user, can } = await requireOrg();
  if (!can({ monitor: ["create"] })) return { ok: false, error: "Your role can't create monitors." };
  const limit = await monitorLimitError(org.id);
  if (limit) return { ok: false, error: limit };
  const n = await normalize(org.id, input);
  if ("error" in n) return { ok: false, error: n.error! };
  const { channelIds, ...v } = n.value;
  const [row] = await db.insert(schema.monitor).values({ ...v, organizationId: org.id, createdBy: user.id }).returning({ id: schema.monitor.id });
  if (channelIds.length) await db.insert(schema.monitorChannel).values(channelIds.map((channelId) => ({ monitorId: row!.id, channelId })));
  await audit({ organizationId: org.id, actorId: user.id, action: "monitor.created", targetType: "monitor", targetId: row!.id, metadata: { name: v.name } });
  return { ok: true, data: { id: row!.id } };
}

export async function updateMonitor(id: string, input: MonitorInput): Promise<Result> {
  const { org, user, can } = await requireOrg();
  if (!can({ monitor: ["update"] })) return { ok: false, error: "Your role can't edit monitors." };
  const [existing] = await db.select().from(schema.monitor).where(and(eq(schema.monitor.id, id), eq(schema.monitor.organizationId, org.id))).limit(1);
  if (!existing) return { ok: false, error: "That monitor no longer exists." };
  const n = await normalize(org.id, input);
  if ("error" in n) return { ok: false, error: n.error! };
  const { channelIds, ...v } = n.value;
  const rewatch = existing.network !== v.network || existing.address !== v.address;
  await db
    .update(schema.monitor)
    .set({ ...v, ...(rewatch ? { lastCheckedBlock: null } : {}), lastError: null })
    .where(eq(schema.monitor.id, id));
  await db.delete(schema.monitorChannel).where(eq(schema.monitorChannel.monitorId, id));
  if (channelIds.length) await db.insert(schema.monitorChannel).values(channelIds.map((channelId) => ({ monitorId: id, channelId })));
  await audit({ organizationId: org.id, actorId: user.id, action: "monitor.updated", targetType: "monitor", targetId: id, metadata: { name: v.name } });
  return { ok: true };
}

export async function setMonitorEnabled(id: string, enabled: boolean): Promise<Result> {
  const { org, user, can } = await requireOrg();
  if (!can({ monitor: ["update"] })) return { ok: false, error: "Your role can't pause or resume monitors." };
  if (enabled) {
    const [current] = await db
      .select({ enabled: schema.monitor.enabled })
      .from(schema.monitor)
      .where(and(eq(schema.monitor.id, id), eq(schema.monitor.organizationId, org.id)))
      .limit(1);
    if (current && !current.enabled) {
      const limit = await monitorLimitError(org.id);
      if (limit) return { ok: false, error: limit };
    }
  }
  const [row] = await db
    .update(schema.monitor)
    .set({ enabled, ...(enabled ? { lastCheckedBlock: null, lastError: null } : {}) })
    .where(and(eq(schema.monitor.id, id), eq(schema.monitor.organizationId, org.id)))
    .returning({ name: schema.monitor.name });
  if (!row) return { ok: false, error: "That monitor no longer exists." };
  await audit({ organizationId: org.id, actorId: user.id, action: enabled ? "monitor.resumed" : "monitor.paused", targetType: "monitor", targetId: id, metadata: { name: row.name } });
  refresh();
  return { ok: true };
}

export async function deleteMonitor(id: string): Promise<Result> {
  const { org, user, can } = await requireOrg();
  if (!can({ monitor: ["delete"] })) return { ok: false, error: "Your role can't delete monitors." };
  const [row] = await db
    .delete(schema.monitor)
    .where(and(eq(schema.monitor.id, id), eq(schema.monitor.organizationId, org.id)))
    .returning({ name: schema.monitor.name });
  if (!row) return { ok: false, error: "That monitor was already deleted." };
  await audit({ organizationId: org.id, actorId: user.id, action: "monitor.deleted", targetType: "monitor", targetId: id, metadata: { name: row.name } });
  return { ok: true };
}

export async function createTelegramLink(): Promise<Result<{ url: string; groupUrl: string; expiresAt: string }>> {
  const { org, user, can } = await requireOrg();
  if (!can({ monitor: ["create"] })) return { ok: false, error: "Your role can't connect channels." };
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  if (!bot || !process.env.TELEGRAM_BOT_TOKEN) return { ok: false, error: "Telegram isn't configured on this server." };
  const code = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await db.insert(schema.telegramLink).values({ code, organizationId: org.id, createdBy: user.id, expiresAt });
  return { ok: true, data: { url: `https://t.me/${bot}?start=${code}`, groupUrl: `https://t.me/${bot}?startgroup=${code}`, expiresAt: expiresAt.toISOString() } };
}

export async function createWebhook(input: { name: string; url: string }): Promise<Result<{ secret: string }>> {
  const { org, user, can } = await requireOrg();
  if (!can({ monitor: ["create"] })) return { ok: false, error: "Your role can't add webhooks." };
  if (!(await getPlan(org.id)).limits.webhooks) return { ok: false, error: "Webhooks are available on the Pro and Team plans. Upgrade in Settings → Billing." };
  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) return { ok: false, error: "Give the webhook a name between 2 and 60 characters." };
  const check = await checkWebhookUrl(input.url.trim());
  if (!check.ok) return { ok: false, error: check.error };
  const secret = generateWebhookSecret();
  const config: WebhookConfig = { url: check.url.toString(), secretEncrypted: encryptSecret(secret), secretHint: `${secret.slice(0, 10)}…` };
  const [row] = await db.insert(schema.notificationChannel).values({ organizationId: org.id, kind: "webhook", name, config, createdBy: user.id }).returning({ id: schema.notificationChannel.id });
  await audit({ organizationId: org.id, actorId: user.id, action: "channel.created", targetType: "notification_channel", targetId: row!.id, metadata: { kind: "webhook", name } });
  refresh();
  return { ok: true, data: { secret } };
}

export async function removeChannel(id: string): Promise<Result> {
  const { org, user, can } = await requireOrg();
  if (!can({ monitor: ["delete"] })) return { ok: false, error: "Your role can't remove channels." };
  const [row] = await db
    .update(schema.notificationChannel)
    .set({ disabledAt: new Date() })
    .where(and(eq(schema.notificationChannel.id, id), eq(schema.notificationChannel.organizationId, org.id), isNull(schema.notificationChannel.disabledAt)))
    .returning({ name: schema.notificationChannel.name, kind: schema.notificationChannel.kind });
  if (!row) return { ok: false, error: "That channel was already removed." };
  await db.delete(schema.monitorChannel).where(eq(schema.monitorChannel.channelId, id));
  await audit({ organizationId: org.id, actorId: user.id, action: "channel.removed", targetType: "notification_channel", targetId: id, metadata: { name: row.name, kind: row.kind } });
  refresh();
  return { ok: true };
}

const SAMPLE: AlertPayload = {
  kind: "transfer",
  network: "base",
  txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  blockNumber: 0,
  timestamp: null,
  address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  direction: "in",
  asset: "USDC",
  value: "25000",
  from: "0x4b1e00000000000000000000000000000000a90c",
  to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
};

async function sendTo(channel: typeof schema.notificationChannel.$inferSelect, monitor: { id: string; name: string }, orgId: string, orgName: string, payload: AlertPayload, ids: { alertId: string; deliveryId: string; createdAt: string }): Promise<SendResult> {
  if (channel.kind === "telegram") return sendTelegram((channel.config as TelegramConfig).chatId, telegramHtml(monitor.name, orgName, payload, true));
  const cfg = channel.config as WebhookConfig;
  return sendWebhook(
    cfg.url,
    decryptSecret(cfg.secretEncrypted),
    webhookBody({ deliveryId: ids.deliveryId, alertId: ids.alertId, organizationId: orgId, monitor, test: true, createdAt: ids.createdAt, alert: payload }),
    { deliveryId: ids.deliveryId, event: "alert.test" },
  );
}

export async function testChannel(id: string): Promise<Result<{ status: number | null }>> {
  const { org, can } = await requireOrg();
  if (!can({ monitor: ["update"] })) return { ok: false, error: "Your role can't send test alerts." };
  const [channel] = await db
    .select()
    .from(schema.notificationChannel)
    .where(and(eq(schema.notificationChannel.id, id), eq(schema.notificationChannel.organizationId, org.id), isNull(schema.notificationChannel.disabledAt)))
    .limit(1);
  if (!channel) return { ok: false, error: "That channel no longer exists." };
  const r = await sendTo(channel, { id: "test", name: "Treasury" }, org.id, org.name, SAMPLE, { alertId: `test_${randomBytes(6).toString("hex")}`, deliveryId: `test_${randomBytes(6).toString("hex")}`, createdAt: new Date().toISOString() });
  return r.ok ? { ok: true, data: { status: r.status } } : { ok: false, error: r.error ?? "Delivery failed" };
}

export async function sendTestAlert(monitorId: string): Promise<Result<{ results: { channel: string; ok: boolean; error: string | null }[] }>> {
  const { org, can } = await requireOrg();
  if (!can({ monitor: ["update"] })) return { ok: false, error: "Your role can't send test alerts." };
  const m = await db.select().from(schema.monitor).where(and(eq(schema.monitor.id, monitorId), eq(schema.monitor.organizationId, org.id))).limit(1);
  const monitor = m[0];
  if (!monitor) return { ok: false, error: "That monitor no longer exists." };
  const channels = await db
    .select({ channel: schema.notificationChannel })
    .from(schema.monitorChannel)
    .innerJoin(schema.notificationChannel, eq(schema.monitorChannel.channelId, schema.notificationChannel.id))
    .where(and(eq(schema.monitorChannel.monitorId, monitorId), isNull(schema.notificationChannel.disabledAt)));
  if (channels.length === 0) return { ok: false, error: "This monitor has no channels. Add Telegram or a webhook first." };

  const ev = monitor.kind === "event" ? parseEventSignature((monitor.params as schema.EventParams).signature) : null;
  const payload: AlertPayload =
    ev && !("error" in ev)
      ? {
          kind: "event",
          network: monitor.network,
          txHash: SAMPLE.txHash,
          blockNumber: 0,
          timestamp: null,
          address: monitor.address,
          event: ev.name,
          args: Object.fromEntries(ev.abi.inputs.map((i, n) => [i.name || `arg${n}`, i.type === "address" ? SAMPLE.from! : "1"])),
        }
      : { ...SAMPLE, network: monitor.network, address: monitor.address, to: monitor.address };
  const [alertRow] = await db
    .insert(schema.alert)
    .values({ organizationId: org.id, monitorId, dedupeKey: `test:${randomBytes(8).toString("hex")}`, title: alertTitle(monitor.name, payload), payload, test: true })
    .returning();
  const results = [];
  for (const { channel } of channels) {
    const [d] = await db.insert(schema.delivery).values({ alertId: alertRow!.id, channelId: channel.id }).returning({ id: schema.delivery.id });
    const r = await sendTo(channel, { id: monitor.id, name: monitor.name }, org.id, org.name, payload, { alertId: alertRow!.id, deliveryId: d!.id, createdAt: alertRow!.createdAt.toISOString() });
    await db
      .update(schema.delivery)
      .set({ status: r.ok ? "delivered" : "failed", attempts: 1, lastAttemptAt: new Date(), lastStatusCode: r.status, lastError: r.error, ...(r.ok ? { deliveredAt: new Date() } : {}) })
      .where(eq(schema.delivery.id, d!.id));
    results.push({ channel: channel.name, ok: r.ok, error: r.error });
  }
  refresh();
  return { ok: true, data: { results } };
}
