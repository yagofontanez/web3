# Systema

A multi-tenant Web3 platform: wallet explorer, on-chain monitoring, a developer API and a smart contract studio, behind one dashboard with organizations and role-based access.

## Stack

| Layer | Choice |
|---|---|
| Web app | Next.js 16 (App Router, Cache Components), React 19, Tailwind 4 |
| Auth | Better Auth: email/password, Sign-In with Ethereum (EIP-4361, EIP-1271 aware), organizations |
| Public API | Fastify 5, Redis-backed rate limiting |
| Jobs | BullMQ on Redis |
| Data | PostgreSQL 17 + Drizzle ORM |
| Chain access | viem, wagmi |

## Layout

```
apps/
  web/      dashboard, auth, org management          :3000
  api/      public REST API (API-key auth in phase 2) :4100
  worker/   background jobs: monitors, webhooks, indexing
packages/
  db/       Drizzle schema + migrations
  shared/   RBAC roles & permissions (shared by web, api, worker)
  chains/   supported chains, RPC clients
```

## Getting started

Requires Node 22+, pnpm and Docker.

```bash
cp .env.example .env            # then set BETTER_AUTH_SECRET: openssl rand -base64 32
pnpm install
pnpm infra:up                   # Postgres on :55432, Redis on :56379
pnpm db:migrate
pnpm dev                        # web, api and worker together
```

## Roles

| Role | Can |
|---|---|
| Owner | Everything, including billing and deleting the organization |
| Admin | Manage members, invitations and all resources |
| Developer | Create projects, API keys, monitors; deploy contracts |
| Viewer | Read-only |

Permissions are defined once in `packages/shared/src/permissions.ts` and enforced server-side (`apps/web/src/lib/dal.ts`, Better Auth endpoints). UI checks only hide controls.

## Security model

- The platform never holds private keys. Contract deploys and SIWE are signed in the user's wallet.
- Sessions are httpOnly cookies; auth endpoints reject cross-origin requests.
- Membership and access changes are written to a per-organization audit log.
- Sign-in redirects only accept same-origin relative paths.

## Roadmap

- [x] **Phase 0: Foundation.** Monorepo, auth (email + wallet), organizations, invitations, RBAC, audit log, API and worker skeletons, CI
- [ ] **Phase 1: Explorer.** Multi-chain balances, ERC-20s, NFTs, transaction history
- [ ] **Phase 2: Developer hub.** Projects, hashed API keys, `/v1` REST API, usage metering, request logs
- [ ] **Phase 3: Monitors.** Wallet and contract event rules, Telegram and signed webhooks with retries
- [ ] **Phase 4: Contract studio.** OpenZeppelin templates, compile, deploy to testnets, ABI interaction, verification
- [ ] **Phase 5: Billing.** Plans and quotas with Stripe
