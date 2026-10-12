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
  api/      public REST API, API-key auth, per-key limits :4100
  worker/   background jobs: monitors, webhooks, indexing
packages/
  db/       Drizzle schema + migrations
  shared/   RBAC roles & permissions (shared by web, api, worker)
  explorer/ portfolio, NFT, activity, ENS and event decoding over Alchemy, Redis-cached
  notify/   alert formatting, Telegram delivery, signed webhooks, secret encryption
  contracts/ Solidity templates, solc compiler with OpenZeppelin, ABI form helpers, Etherscan client
  chains/   supported chains, RPC clients
```

## Getting started

Requires Node 22+, pnpm and Docker.

```bash
cp .env.example .env            # set BETTER_AUTH_SECRET (openssl rand -base64 32) and ALCHEMY_API_KEY
pnpm install
pnpm infra:up                   # Postgres on :55432, Redis on :56379
pnpm db:migrate
pnpm dev                        # web, api and worker together
```

## Data providers

The explorer reads from Alchemy. Enable Ethereum, Base, Polygon, Arbitrum, Optimism, Sepolia and Base Sepolia in your Alchemy app: balances use the Portfolio API, activity uses `alchemy_getAssetTransfers` per network. Etherscan's free tier does not cover Base or Optimism, so it is reserved for contract ABIs and verification in the contract studio.

Responses are cached in Redis (balances 60s, NFTs 5 min, activity 30s). Tokens without a market price and NFTs flagged as spam are hidden by default.

## Public API

`apps/api` serves `/v1` over the explorer package. Keys look like `w3s_live_…`, are stored only as an HMAC-SHA256 with `API_KEY_PEPPER`, and are cached in Redis for 60s (revocation clears the cache immediately). Each key has one per-minute limit shared across every endpoint. Requests are logged in batches to `api_request_log` and pruned after 30 days by the worker. The reference lives in the dashboard under API & keys.

## Monitors

The worker scans every enabled monitor every 30 seconds from the block after its last checkpoint, so nothing is missed between scans and each match alerts once (unique on monitor and transfer or log id). Contract events are read with `eth_getLogs` in windows of `ALCHEMY_GETLOGS_RANGE` blocks (10 on Alchemy's free tier).

Deliveries are at-least-once: they retry up to 6 times with exponential backoff starting at 15s, and a worker that loses a job lock (for example after the machine sleeps) may send the same delivery again. Receivers should dedupe on the `x-systema-delivery` header. Webhooks carry `x-systema-signature: t=<unix>,v1=<hmac-sha256(secret, "t.body")>`; secrets are stored encrypted with AES-256-GCM. Webhook URLs must be https and public unless `ALLOW_PRIVATE_WEBHOOKS=true` (local development only).

A scan that matches more than 25 times sends the first 5 plus a summary, and a monitor that sends over 200 alerts in an hour pauses itself and says why.

Telegram linking uses one-time `/start` codes that expire in 30 minutes. The worker long-polls the bot, guarded by a Redis lock so only one worker listens.

## Contract studio

Templates are generated from validated options (no user text reaches the source unescaped) and compiled with solc 0.8.37 against OpenZeppelin Contracts 5.6, EVM `cancun`, optimizer 200 runs. Custom Solidity can only import `@openzeppelin/contracts`. Deployments and writes are signed in the user's wallet; the server never holds keys. Studio deploys are limited to Sepolia and Base Sepolia, and verification uses the Etherscan v2 standard-JSON flow.

To try deploys without test ETH, run a local node and point the studio at it:

```bash
npx hardhat node                 # in any folder with Hardhat 3 installed
# .env
STUDIO_LOCAL_RPC=http://127.0.0.1:8545
NEXT_PUBLIC_STUDIO_LOCAL=true
```

`LOCAL_EVM_URL=http://127.0.0.1:8545 pnpm --filter @w3s/contracts test` also deploys every template to that node and exercises mint, burn, pause and ownership.

## Billing

Plans live in `packages/billing/src/plans.ts`. Free covers 10,000 API requests a month, 3 active monitors and 3 members. Pro ($29) and Team ($99) raise those limits and unlock webhook alerts.

```bash
# .env: a sandbox key from the Stripe dashboard
STRIPE_SECRET_KEY=sk_test_...
pnpm --filter @w3s/billing setup-stripe        # products, prices (by lookup key) and the portal config, idempotent
stripe listen --api-key "$STRIPE_SECRET_KEY" --forward-to localhost:3000/api/stripe/webhook
# copy the whsec_... it prints into STRIPE_WEBHOOK_SECRET and restart pnpm dev
```

New subscriptions go through Stripe Checkout; plan changes, cancellations, cards and invoices go through the Customer Portal. The app never trusts the success page: `/api/stripe/webhook` verifies the signature, re-reads the subscription from Stripe, upserts it under a row lock and records each event ID so retries are idempotent. Test with card `4242 4242 4242 4242`.

Limits are enforced on the server. The public API counts requests per organization per UTC month in Redis and answers `402 quota_exceeded` past the limit, with `x-quota-limit`, `x-quota-remaining` and `x-quota-reset` on every response. Creating or resuming monitors, adding webhooks and sending invitations check the plan. A downgrade pauses the newest monitors above the new limit and says why.

For production, use a restricted API key (`rk_`) with write access to Customers, Checkout Sessions, Customer Portal and Subscriptions and read access to Prices. Sales tax isn't calculated: turn on Stripe Tax and `automatic_tax` only after adding a tax registration.

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
- [x] **Phase 1: Explorer.** Multi-chain portfolio with USD values, NFTs with spam filtering, activity history, ENS, org-saved addresses
- [x] **Phase 2: Developer hub.** Projects, HMAC-hashed API keys shown once, `/v1` REST API, per-key rate limits, request logs, usage charts, in-app reference
- [x] **Phase 3: Monitors.** Wallet transfer and contract event rules, Telegram and HMAC-signed webhooks with retries, flood protection
- [x] **Phase 4: Contract studio.** OpenZeppelin templates, solc compile, wallet deploys to testnets, ABI-driven read/write, Etherscan verification and import
- [x] **Phase 5: Billing.** Free, Pro and Team plans on Stripe Checkout and the Customer Portal, webhook-synced subscriptions, monthly API quotas and plan limits
