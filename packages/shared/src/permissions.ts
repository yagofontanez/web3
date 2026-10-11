import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, ownerAc, adminAc } from "better-auth/plugins/organization/access";

export const statements = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete"],
  address: ["create", "read", "delete"],
  apiKey: ["create", "read", "revoke"],
  monitor: ["create", "read", "update", "delete"],
  contract: ["create", "read", "deploy", "delete"],
  billing: ["read", "update"],
  audit: ["read"],
} as const;

export const ac = createAccessControl(statements);

const allPlatform = {
  project: ["create", "read", "update", "delete"],
  address: ["create", "read", "delete"],
  apiKey: ["create", "read", "revoke"],
  monitor: ["create", "read", "update", "delete"],
  contract: ["create", "read", "deploy", "delete"],
} as const;

export const owner = ac.newRole({
  ...ownerAc.statements,
  ...allPlatform,
  billing: ["read", "update"],
  audit: ["read"],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  ...allPlatform,
  billing: ["read"],
  audit: ["read"],
});

export const developer = ac.newRole({
  ...allPlatform,
});

export const viewer = ac.newRole({
  project: ["read"],
  address: ["read"],
  apiKey: ["read"],
  monitor: ["read"],
  contract: ["read"],
});

export const roles = { owner, admin, developer, viewer };
export type OrgRole = keyof typeof roles;
export const ORG_ROLES = Object.keys(roles) as OrgRole[];
