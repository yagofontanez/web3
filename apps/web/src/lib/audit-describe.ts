export function describeAudit(action: string, meta: Record<string, unknown> | null): string {
  const m = meta ?? {};
  switch (action) {
    case "organization.created":
      return "created the organization";
    case "organization.updated":
      return m.name ? `renamed the organization to ${m.name}` : "updated the organization";
    case "invitation.created":
      return `invited ${m.email ?? "someone"} as ${m.role ?? "a member"}`;
    case "invitation.canceled":
      return `canceled the invitation for ${m.email ?? "someone"}`;
    case "invitation.accepted":
      return "joined the organization";
    case "member.role_updated":
      return `changed ${m.name || m.email || "a member"}'s role from ${m.from} to ${m.to}`;
    case "member.removed":
      return `removed ${m.name || m.email || "a member"}`;
    case "member.left":
      return "left the organization";
    case "address.saved":
      return `saved ${m.label ?? "a wallet"}`;
    case "address.removed":
      return `stopped watching ${m.label ?? "a wallet"}`;
    case "project.created":
      return `created the project ${m.name ?? ""}`.trim();
    case "project.updated":
      return `updated the project ${m.name ?? ""}`.trim();
    case "project.archived":
      return `archived the project ${m.name ?? ""}`.trim();
    case "api_key.created":
      return `created the API key ${m.name ?? ""} in ${m.project ?? "a project"}`;
    case "api_key.revoked":
      return `revoked the API key ${m.name ?? ""}`.trim();
    case "monitor.created":
      return `created the monitor ${m.name ?? ""}`.trim();
    case "monitor.updated":
      return `edited the monitor ${m.name ?? ""}`.trim();
    case "monitor.paused":
      return `paused the monitor ${m.name ?? ""}`.trim();
    case "monitor.resumed":
      return `resumed the monitor ${m.name ?? ""}`.trim();
    case "monitor.deleted":
      return `deleted the monitor ${m.name ?? ""}`.trim();
    case "channel.created":
      return `connected ${m.kind === "telegram" ? "the Telegram chat" : "the webhook"} ${m.name ?? ""}`.trim();
    case "channel.removed":
      return `removed the channel ${m.name ?? ""}`.trim();
    default:
      return action;
  }
}
