import { describe, expect, it } from "vitest";
import { alertTitle, telegramHtml, type AlertContent } from "./format";
import { decryptSecret, encryptSecret, generateWebhookSecret, signWebhook, verifyWebhookSignature } from "./secrets";
import { checkWebhookUrl, isPrivateIp } from "./send";

const MASTER = "m".repeat(40);
const transfer: AlertContent = {
  kind: "transfer",
  network: "base",
  txHash: "0xabc",
  blockNumber: 1234567,
  timestamp: null,
  address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  direction: "in",
  asset: "USDC",
  value: "25000",
  from: "0x4b1e000000000000000000000000000000a90c",
  to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
};

describe("secrets", () => {
  it("encrypts and decrypts webhook secrets, rejecting tampering and other keys", () => {
    const secret = generateWebhookSecret();
    const sealed = encryptSecret(secret, MASTER);
    expect(sealed).not.toContain(secret);
    expect(decryptSecret(sealed, MASTER)).toBe(secret);
    expect(() => decryptSecret(sealed, "n".repeat(40))).toThrow();
    const parts = sealed.split(".");
    parts[3] = parts[3]!.slice(0, -2) + (parts[3]!.endsWith("A") ? "BB" : "AA");
    expect(() => decryptSecret(parts.join("."), MASTER)).toThrow();
  });

  it("signs payloads and verifies them within the tolerance window", () => {
    const body = JSON.stringify({ hello: "world" });
    const header = signWebhook("whsec_x", 1_700_000_000, body);
    expect(header).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
    expect(verifyWebhookSignature("whsec_x", header, body, 1_700_000_100)).toBe(true);
    expect(verifyWebhookSignature("whsec_x", header, body + " ", 1_700_000_100)).toBe(false);
    expect(verifyWebhookSignature("whsec_y", header, body, 1_700_000_100)).toBe(false);
    expect(verifyWebhookSignature("whsec_x", header, body, 1_700_001_000)).toBe(false);
  });
});

describe("format", () => {
  it("writes a readable title for transfers and events", () => {
    expect(alertTitle("Treasury", transfer)).toBe("Treasury received 25,000 USDC on Base");
    expect(alertTitle("Treasury", { ...transfer, direction: "out", value: "1.5", asset: "ETH" })).toBe("Treasury sent 1.5 ETH on Base");
    expect(alertTitle("Vault", { ...transfer, kind: "event", event: "OwnershipTransferred" })).toBe("Vault: OwnershipTransferred on Base");
  });

  it("escapes HTML in Telegram messages and links to the explorer", () => {
    const html = telegramHtml("<script>", "Acme & Co", transfer);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Acme &amp; Co");
    expect(html).toContain("https://basescan.org/tx/0xabc");
  });
});

describe("webhook url safety", () => {
  it("flags private, loopback and link-local addresses", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "192.168.0.10", "172.20.1.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) expect(isPrivateIp(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"]) expect(isPrivateIp(ip)).toBe(false);
  });

  it("rejects non-https, credentials and internal hosts unless explicitly allowed", async () => {
    expect((await checkWebhookUrl("http://example.com/hook", false)).ok).toBe(false);
    expect((await checkWebhookUrl("https://user:pw@example.com/hook", false)).ok).toBe(false);
    expect((await checkWebhookUrl("https://127.0.0.1/hook", false)).ok).toBe(false);
    expect((await checkWebhookUrl("https://169.254.169.254/latest/meta-data", false)).ok).toBe(false);
    expect((await checkWebhookUrl("http://localhost:9999/hook", true)).ok).toBe(true);
  });
});
