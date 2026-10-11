import type { OrgRole } from "@w3s/shared/permissions";

export const ROLE_ORDER: OrgRole[] = ["owner", "admin", "developer", "viewer"];

export const ROLE_INFO: Record<OrgRole, { label: string; summary: string }> = {
  owner: { label: "Owner", summary: "Everything, including billing and deleting the organization." },
  admin: { label: "Admin", summary: "Manages members, invitations and every resource." },
  developer: { label: "Developer", summary: "Builds: projects, API keys, monitors, contract deploys." },
  viewer: { label: "Viewer", summary: "Sees everything, changes nothing." },
};
