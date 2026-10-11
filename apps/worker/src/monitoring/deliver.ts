import { eq } from "drizzle-orm";
import type { Job } from "bullmq";
import { db, schema } from "@w3s/db";
import type { TelegramConfig, WebhookConfig } from "@w3s/db/schema";
import { decryptSecret, sendTelegram, sendWebhook, telegramHtml, webhookBody } from "@w3s/notify";
import type { DeliveryJob } from "./process";

export const DELIVERY_ATTEMPTS = 6;

export async function deliver(job: Job<DeliveryJob>) {
  const [row] = await db
    .select({
      delivery: schema.delivery,
      alert: schema.alert,
      channel: schema.notificationChannel,
      monitorName: schema.monitor.name,
      orgName: schema.organization.name,
    })
    .from(schema.delivery)
    .innerJoin(schema.alert, eq(schema.delivery.alertId, schema.alert.id))
    .innerJoin(schema.notificationChannel, eq(schema.delivery.channelId, schema.notificationChannel.id))
    .innerJoin(schema.monitor, eq(schema.alert.monitorId, schema.monitor.id))
    .innerJoin(schema.organization, eq(schema.alert.organizationId, schema.organization.id))
    .where(eq(schema.delivery.id, job.data.deliveryId))
    .limit(1);
  if (!row || row.delivery.status === "delivered") return { skipped: true };
  if (row.channel.disabledAt) {
    await db.update(schema.delivery).set({ status: "failed", lastError: "Channel was removed" }).where(eq(schema.delivery.id, row.delivery.id));
    return { skipped: true };
  }

  const result =
    row.channel.kind === "telegram"
      ? await sendTelegram((row.channel.config as TelegramConfig).chatId, telegramHtml(row.monitorName, row.orgName, row.alert.payload, row.alert.test, row.alert.title))
      : await sendWebhook(
          (row.channel.config as WebhookConfig).url,
          decryptSecret((row.channel.config as WebhookConfig).secretEncrypted),
          webhookBody({
            deliveryId: row.delivery.id,
            alertId: row.alert.id,
            organizationId: row.alert.organizationId,
            monitor: { id: row.alert.monitorId, name: row.monitorName },
            test: row.alert.test,
            createdAt: row.alert.createdAt.toISOString(),
            alert: row.alert.payload,
            title: row.alert.title,
          }),
          { deliveryId: row.delivery.id, event: row.alert.test ? "alert.test" : "alert.triggered" },
        );

  const attempts = row.delivery.attempts + 1;
  const final = !result.ok && job.attemptsMade + 1 >= (job.opts.attempts ?? DELIVERY_ATTEMPTS);
  await db
    .update(schema.delivery)
    .set({
      attempts,
      lastAttemptAt: new Date(),
      lastStatusCode: result.status,
      lastError: result.error,
      status: result.ok ? "delivered" : final ? "failed" : "pending",
      ...(result.ok ? { deliveredAt: new Date() } : {}),
    })
    .where(eq(schema.delivery.id, row.delivery.id));

  if (!result.ok) throw new Error(result.error ?? "Delivery failed");
  return { delivered: true, status: result.status };
}
