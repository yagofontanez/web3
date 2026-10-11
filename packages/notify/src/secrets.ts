import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

function key(master = process.env.API_KEY_PEPPER) {
  if (!master || master.length < 32) throw new Error("API_KEY_PEPPER must be set to at least 32 characters");
  return Buffer.from(hkdfSync("sha256", master, "w3s", "notification-channel-secrets", 32));
}

export function encryptSecret(plain: string, master?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(master), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(sealed: string, master?: string) {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unsupported secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(master), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function generateWebhookSecret() {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export function signWebhook(secret: string, timestamp: number, body: string) {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

export function verifyWebhookSignature(secret: string, header: string, body: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1 || Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = Buffer.from(signWebhook(secret, t, body).split("v1=")[1]!, "hex");
  const given = Buffer.from(parts.v1, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
