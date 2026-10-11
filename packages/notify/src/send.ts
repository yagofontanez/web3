import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { signWebhook } from "./secrets";

export type SendResult = { ok: boolean; status: number | null; error: string | null };

export async function sendTelegram(chatId: string, html: string, token = process.env.TELEGRAM_BOT_TOKEN): Promise<SendResult> {
  if (!token) return { ok: false, status: null, error: "TELEGRAM_BOT_TOKEN is not set" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return json.ok ? { ok: true, status: res.status, error: null } : { ok: false, status: res.status, error: json.description ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, status: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export function isPrivateIp(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

export async function checkWebhookUrl(raw: string, allowPrivate = process.env.ALLOW_PRIVATE_WEBHOOKS === "true"): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "That isn't a valid URL." };
  }
  if (url.protocol !== "https:" && !(allowPrivate && url.protocol === "http:")) return { ok: false, error: "Webhook URLs must use https." };
  if (url.username || url.password) return { ok: false, error: "Remove credentials from the URL." };
  if (allowPrivate) return { ok: true, url };
  try {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (addresses.some((a) => isPrivateIp(a.address))) return { ok: false, error: "Webhook URLs can't point to private or internal addresses." };
  } catch {
    return { ok: false, error: "That hostname doesn't resolve." };
  }
  return { ok: true, url };
}

export async function sendWebhook(url: string, secret: string, body: unknown, ids: { deliveryId: string; event: string }): Promise<SendResult> {
  const check = await checkWebhookUrl(url);
  if (!check.ok) return { ok: false, status: null, error: check.error };
  const payload = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000);
  try {
    const res = await fetch(check.url, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        "user-agent": "Systema-Webhooks/1.0",
        "x-systema-event": ids.event,
        "x-systema-delivery": ids.deliveryId,
        "x-systema-signature": signWebhook(secret, timestamp, payload),
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? { ok: true, status: res.status, error: null } : { ok: false, status: res.status, error: `Endpoint answered ${res.status}` };
  } catch (err) {
    return { ok: false, status: null, error: err instanceof Error && err.name === "TimeoutError" ? "Timed out after 10s" : err instanceof Error ? err.message : String(err) };
  }
}
