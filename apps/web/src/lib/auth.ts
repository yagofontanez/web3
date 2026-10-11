import { betterAuth } from "better-auth";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization, siwe } from "better-auth/plugins";
import { generateSiweNonce } from "viem/siwe";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@w3s/db";
import { getPublicClient } from "@w3s/chains";
import { ac, roles } from "@w3s/shared/permissions";
import { audit, type AuditEntry } from "./audit";

const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const pendingMemberAudits = new Map<string, AuditEntry>();
const MEMBER_PATHS = new Set(["/organization/update-member-role", "/organization/remove-member", "/organization/leave"]);

function holdMemberAudit(keys: (string | undefined)[], entry: AuditEntry) {
  for (const key of keys) if (key) pendingMemberAudits.set(key, entry);
}

function takeMemberAudit(keys: (string | undefined)[]) {
  for (const key of keys) {
    const entry = key ? pendingMemberAudits.get(key) : undefined;
    if (entry) {
      for (const [k, v] of pendingMemberAudits) if (v === entry) pendingMemberAudits.delete(k);
      return entry;
    }
  }
  return undefined;
}

export const auth = betterAuth({
  baseURL: appUrl,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [membership] = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .orderBy(schema.member.createdAt)
            .limit(1);
          return { data: { ...session, activeOrganizationId: membership?.organizationId ?? null } };
        },
      },
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (!MEMBER_PATHS.has(ctx.path)) return;
      const body = (ctx.body ?? {}) as { memberId?: string; memberIdOrEmail?: string; organizationId?: string };
      const actorId = (await getSessionFromCtx(ctx).catch(() => null))?.user.id ?? null;

      if (ctx.path === "/organization/leave") {
        if (!actorId || !body.organizationId) return;
        const [still] = await db
          .select({ id: schema.member.id })
          .from(schema.member)
          .where(and(eq(schema.member.userId, actorId), eq(schema.member.organizationId, body.organizationId)))
          .limit(1);
        if (!still) await audit({ organizationId: body.organizationId, actorId, action: "member.left" });
        return;
      }

      const entry = takeMemberAudit([
        body.memberId && `member:${body.memberId}`,
        body.memberIdOrEmail && `member:${body.memberIdOrEmail}`,
        body.memberIdOrEmail && `email:${body.memberIdOrEmail}`,
      ]);
      if (!entry) return;
      const selfRemoval = entry.action === "member.removed" && entry.metadata?.userId === actorId;
      await audit({ ...entry, action: selfRemoval ? "member.left" : entry.action, actorId });
    }),
  },
  rateLimit: { enabled: true, window: 60, max: 100 },
  advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
  plugins: [
    organization({
      ac,
      roles,
      creatorRole: "owner",
      allowUserToCreateOrganization: true,
      invitationExpiresIn: 60 * 60 * 48,
      async sendInvitationEmail() {},
      organizationHooks: {
        afterCreateOrganization: async ({ organization, user }) =>
          audit({ organizationId: organization.id, actorId: user.id, action: "organization.created" }),
        afterCreateInvitation: async ({ invitation, inviter, organization }) =>
          audit({
            organizationId: organization.id,
            actorId: inviter.id,
            action: "invitation.created",
            targetType: "invitation",
            targetId: invitation.id,
            metadata: { email: invitation.email, role: invitation.role },
          }),
        afterAcceptInvitation: async ({ invitation, user, organization }) =>
          audit({
            organizationId: organization.id,
            actorId: user.id,
            action: "invitation.accepted",
            targetType: "invitation",
            targetId: invitation.id,
          }),
        afterUpdateOrganization: async ({ organization, user }) => {
          if (!organization) return;
          await audit({
            organizationId: organization.id,
            actorId: user.id,
            action: "organization.updated",
            metadata: { name: organization.name },
          });
        },
        afterCancelInvitation: async ({ invitation, cancelledBy, organization }) =>
          audit({
            organizationId: organization.id,
            actorId: cancelledBy.id,
            action: "invitation.canceled",
            targetType: "invitation",
            targetId: invitation.id,
            metadata: { email: invitation.email, role: invitation.role },
          }),
        afterUpdateMemberRole: async ({ member, previousRole, user, organization }) =>
          holdMemberAudit([`member:${member.id}`], {
            organizationId: organization.id,
            action: "member.role_updated",
            targetType: "member",
            targetId: member.id,
            metadata: { email: user.email, name: user.name, from: previousRole, to: member.role },
          }),
        afterRemoveMember: async ({ member, user, organization }) =>
          holdMemberAudit([`member:${member.id}`, `email:${user.email}`, `user:${user.id}`], {
            organizationId: organization.id,
            action: "member.removed",
            targetType: "member",
            targetId: member.id,
            metadata: { email: user.email, name: user.name, userId: user.id },
          }),
      },
    }),
    siwe({
      domain: new URL(appUrl).host,
      anonymous: true,
      getNonce: async () => generateSiweNonce(),
      verifyMessage: async ({ message, signature, address, chainId }) => {
        try {
          return await getPublicClient(chainId).verifyMessage({
            address: address as `0x${string}`,
            message,
            signature: signature as `0x${string}`,
          });
        } catch {
          return false;
        }
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
