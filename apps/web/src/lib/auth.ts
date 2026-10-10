import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization, siwe } from "better-auth/plugins";
import { generateSiweNonce } from "viem/siwe";
import { eq } from "drizzle-orm";
import { db, schema } from "@w3s/db";
import { getPublicClient } from "@w3s/chains";
import { ac, roles } from "@w3s/shared/permissions";
import { audit } from "./audit";

const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

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
        afterUpdateMemberRole: async ({ member, previousRole, organization }) =>
          audit({
            organizationId: organization.id,
            action: "member.role_updated",
            targetType: "member",
            targetId: member.id,
            metadata: { from: previousRole, to: member.role },
          }),
        afterRemoveMember: async ({ member, user, organization }) =>
          audit({
            organizationId: organization.id,
            action: "member.removed",
            targetType: "member",
            targetId: member.id,
            metadata: { email: user.email },
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
