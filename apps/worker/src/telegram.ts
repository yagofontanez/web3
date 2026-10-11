import { and, eq, gt, isNull } from "drizzle-orm";
import type { Redis } from "ioredis";
import { db, schema } from "@w3s/db";
import { sendTelegram } from "@w3s/notify";
import { parseStart } from "./telegram-parse";

type Update = {
  update_id: number;
  message?: { text?: string; chat: { id: number; type: string; title?: string; username?: string; first_name?: string } };
};

const LOCK = "w3s:telegram:poller";
const OFFSET = "w3s:telegram:offset";

async function link(code: string, chat: NonNullable<Update["message"]>["chat"]) {
  const now = new Date();
  const [row] = await db
    .select({ code: schema.telegramLink.code, organizationId: schema.telegramLink.organizationId, createdBy: schema.telegramLink.createdBy, orgName: schema.organization.name })
    .from(schema.telegramLink)
    .innerJoin(schema.organization, eq(schema.telegramLink.organizationId, schema.organization.id))
    .where(and(eq(schema.telegramLink.code, code), isNull(schema.telegramLink.usedAt), gt(schema.telegramLink.expiresAt, now)))
    .limit(1);
  const chatId = String(chat.id);
  if (!row) {
    await sendTelegram(chatId, "That link expired or was already used. Open Monitors in Systema and choose <b>Connect Telegram</b> again.");
    return;
  }
  const title = chat.title ?? (chat.username ? `@${chat.username}` : (chat.first_name ?? "Telegram chat"));
  const [channel] = await db
    .insert(schema.notificationChannel)
    .values({
      organizationId: row.organizationId,
      kind: "telegram",
      name: title,
      config: { chatId, chatTitle: title, chatType: chat.type },
      createdBy: row.createdBy,
    })
    .returning({ id: schema.notificationChannel.id });
  await db.update(schema.telegramLink).set({ usedAt: now, channelId: channel!.id }).where(eq(schema.telegramLink.code, code));
  await db.insert(schema.auditLog).values({
    organizationId: row.organizationId,
    actorId: row.createdBy,
    action: "channel.created",
    targetType: "notification_channel",
    targetId: channel!.id,
    metadata: { kind: "telegram", name: title },
  });
  await sendTelegram(chatId, `✅ Connected to <b>${row.orgName.replace(/[<>&]/g, "")}</b>. Monitors that use this chat will post their alerts here.`);
}

export function startTelegramPoller(redis: Redis) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const username = process.env.TELEGRAM_BOT_USERNAME ?? "";
  if (!token) {
    console.log("[telegram] TELEGRAM_BOT_TOKEN not set, linking disabled");
    return () => {};
  }
  let stopped = false;
  const owner = crypto.randomUUID();

  (async () => {
    while (!stopped) {
      const got = await redis.set(LOCK, owner, "EX", 60, "NX").catch(() => null);
      const mine = got === "OK" || (await redis.get(LOCK).catch(() => null)) === owner;
      if (!mine) {
        await new Promise((r) => setTimeout(r, 15_000));
        continue;
      }
      await redis.expire(LOCK, 60).catch(() => 0);
      try {
        const offset = Number((await redis.get(OFFSET)) ?? 0);
        const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ offset, timeout: 25, allowed_updates: ["message"] }),
          signal: AbortSignal.timeout(35_000),
        });
        const json = (await res.json()) as { ok: boolean; result?: Update[]; description?: string };
        if (!json.ok) throw new Error(json.description ?? `HTTP ${res.status}`);
        for (const u of json.result ?? []) {
          await redis.set(OFFSET, String(u.update_id + 1));
          const code = parseStart(u.message?.text, username);
          if (code && u.message) await link(code, u.message.chat).catch((err) => console.error("[telegram] link failed", err));
        }
      } catch (err) {
        if (!stopped) {
          console.error("[telegram] poll failed:", err instanceof Error ? err.message : err);
          await new Promise((r) => setTimeout(r, 5_000));
        }
      }
    }
    if ((await redis.get(LOCK).catch(() => null)) === owner) await redis.del(LOCK).catch(() => 0);
  })();

  console.log(`[telegram] listening as @${username}`);
  return () => {
    stopped = true;
  };
}
