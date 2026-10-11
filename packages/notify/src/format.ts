import { addressUrl, networkBySlug, txUrl } from "@w3s/explorer";

export type AlertContent = {
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

export const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "unknown");

export function formatAmount(value: string | null | undefined) {
  if (value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (n !== 0 && Math.abs(n) < 0.0001) return "<0.0001";
  return n.toLocaleString("en", { maximumFractionDigits: Math.abs(n) >= 1000 ? 2 : 6 });
}

export function alertTitle(monitorName: string, a: AlertContent) {
  const net = networkBySlug(a.network)?.name ?? a.network;
  if (a.kind === "event") return `${monitorName}: ${a.event ?? "Event"} on ${net}`;
  const verb = a.direction === "out" ? "sent" : a.direction === "self" ? "moved" : "received";
  return `${monitorName} ${verb} ${formatAmount(a.value)} ${a.asset ?? ""} on ${net}`.replace(/\s+/g, " ").trim();
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function telegramHtml(monitorName: string, orgName: string, a: AlertContent, test = false, title?: string) {
  const network = networkBySlug(a.network);
  const lines: string[] = [];
  lines.push(`${test ? "🧪 <b>Test alert</b>\n" : ""}<b>${escape(title ?? alertTitle(monitorName, a))}</b>`);
  if (a.kind === "transfer") {
    if (a.from) lines.push(`From <code>${escape(short(a.from))}</code>`);
    if (a.to) lines.push(`To <code>${escape(short(a.to))}</code>`);
  } else if (a.args) {
    for (const [k, v] of Object.entries(a.args).slice(0, 6)) lines.push(`${escape(k)}: <code>${escape(v.length > 20 ? short(v) : v)}</code>`);
  }
  lines.push(`Block ${a.blockNumber.toLocaleString("en")}`);
  if (network) {
    lines.push(`<a href="${txUrl(network, a.txHash)}">View transaction</a> · <a href="${addressUrl(network, a.address)}">Watched address</a>`);
  }
  lines.push(`<i>${escape(orgName)} on Systema</i>`);
  return lines.join("\n");
}

export function webhookBody(params: { deliveryId: string; alertId: string; monitor: { id: string; name: string }; organizationId: string; test: boolean; createdAt: string; alert: AlertContent; title?: string }) {
  return {
    id: params.deliveryId,
    type: params.test ? "alert.test" : "alert.triggered",
    createdAt: params.createdAt,
    organizationId: params.organizationId,
    monitor: params.monitor,
    alert: { id: params.alertId, title: params.title ?? alertTitle(params.monitor.name, params.alert), ...params.alert },
  };
}
