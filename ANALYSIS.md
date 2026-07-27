# ENERGENIUS Award System — Service Analysis

> This is one of three linked service analyses. **Shared ecosystem architecture** (identity model, token introspection, roles/pilot-scoping, cross-repo timeline) is documented once in **`energenius-nexus/ANALYSIS.md` → Part A**. This file covers the Award System service specifically.
>
> Companion documents: `energenius-nexus/ANALYSIS.md`, `energenius-data-beacon/ANALYSIS.md`.
> Commit window: **1 May 2026 → 12 Jul 2026** (`dev` branch), 15 commits.

---

## 1. Purpose

The Energenius Award System (a.k.a. "ENERGENIUS Sandbox Wallet") is a **gamification / rewards micro-service**. It grants users blockchain-backed reward tokens ("ENCOIN" / ENC) when they perform recognized actions ("award events") across the platform's sub-apps (Community, Dashboard, Education Hub, ENPlay, Guru, Market, Panorama, S2DT). Users can also spend tokens and view a wallet balance + transaction history.

- **Custodial, backend-controlled wallet.** Users hold no keys; an EVM address is deterministically derived from the Nexus user id (`core/src/utils/wallet.ts`, `deriveAddress` → `keccak256("ENERGENIUS:" + uid)`).
- Tokens live on an EVM chain (Polygon Amoy / configurable) via an `ENCOIN` contract with `award` / `spend` / `balanceOf` (`core/src/chain/chain.service.ts`).
- Rules-driven: each event type has a reward amount and per-user / per-day caps, plus a global daily cap of 5 tokens (`scan_property` exempt, grants 25).
- Deploy: HTTPS/nginx/Let's Encrypt on `energenius-wallet.zentrix.io` (`README-DEPLOYMENT.md`), local Docker in `README-DEV-DOCKER.md`.

## 2. Repo structure

- **`core/`** — Backend. **NestJS 11** (TypeScript). Source in `core/src`, Prisma in `core/prisma`. `package.json` name still `"starter"`, v1.1.1.
- **`frontend/`** — **Next.js 14** (App Router, React 18, Tailwind) demo/sandbox UI (login + wallet page). `"energenius-frontend"`, v1.1.1.
- **`archive/`** — zipped old backends (`backend.zip`, `backend_old.zip`), not live.
- **`scripts/`** — ops helpers (`restore-dev-db.sh`).

## 3. Tech stack

**Backend (`core/`):** NestJS 11, Swagger at `/v1/api-docs`, Prisma 7 over PostgreSQL (`@prisma/adapter-pg`), **ethers v6** (ENCOIN ABI at `core/src/chain/abi/encoin.abi.json`), `@nestjs/jwt`+`passport-jwt`+`argon2` (local admin login) plus Nexus introspection guards. Global prefix `/v1`, port 3001. BullMQ/bull-board, Bugsnag, Multer present but largely scaffold.

**Frontend (`frontend/`):** Next.js 14.0.4, React 18, Tailwind, `ethers`, `lucide-react`, `react-hot-toast`. Talks to backend via `NEXT_PUBLIC_API_URL` and Nexus via `NEXT_PUBLIC_NEXUS_API_URL`.

## 4. Backend modules (`core/src`)

- **`award/`** — Core award-granting logic. `AwardController`, `AwardService` (grant/spend/available), `AwardTableService` (rule lookup), repositories (`award.repository.ts`, `award-rule.repository.ts`, `tx-log.repository.ts`). DTOs: `event.dto.ts`, `uid.dto.ts`.
- **`wallet/`** — `WalletController` + `WalletService` (snapshot: address, balance, last 10 tx), `user-wallet.repository.ts`, `spend.dto.ts`.
- **`chain/`** — `ChainService` wraps ethers provider/signer + ENCOIN contract (`award`, `spend`, `balanceOf`, `owner`).
- **`auth/`** — Nexus `IntrospectionGuard`, `IsComponentGuard`, local JWT strategies, `RolesGuard`/permissions; `AuthService.userExists()` calls Nexus.
- **`users/`, `roles/`** — Admin CRUD for local User/Role/Permission (RBAC via `PermissionEnum`), independent of Nexus identities.
- **`files/`** — generic file upload (scaffold, unused by award flow).
- **`prisma/`, `logger/`, `exception/`, `base-classes/`, `dto/`, `enum/`, `types/`, `utils/`** — infra + `deriveAddress` + award constants (`DAILY_TOKEN_CAP=5`, `EXEMPT_AWARD_EVENTS=['scan_property']`).

A **global `IntrospectionGuard`** is applied to every route (`main.ts`).

## 5. API surface (prefix `/v1`)

**Award (`core/src/award/award.controller.ts`, `/v1/award`):**
- `POST /v1/award/event` — grant tokens for an event to a target user. Guards: `IntrospectionGuard` + **`IsComponentGuard`** (component-only). Body = `EventDto`. Extracts the component's bearer token and passes it downstream. Returns `{ txHash, awarde_amount, new_balance }`.
- `GET /v1/award/` — list all award rules.
- `GET /v1/award/available` — available awards for the calling user (uid from introspected `nexus_user_id`); per-rule `awarded_count`, `today_count`, `remaining`, `is_available`.

**Wallet (`core/src/wallet/wallet.controller.ts`, `/v1/wallet`):**
- `POST /v1/wallet/spend` — debit tokens from caller's wallet. Body = `AwardDto` (`amount ≥1`, optional `label`). uid from `req.user.nexus_user_id`.
- `GET /v1/wallet` — snapshot `{ uid, address, balance_wei, history[] }` (last 10 tx).

**Auth (`/v1/auth`) — local admin, separate from Nexus:** `POST /v1/auth/signin` (`@Public`), `GET /v1/auth/refresh`, `GET /v1/auth/logout`.
**Users (`/v1/users`)** — full CRUD guarded by `RolesGuard` + permissions.

## 6. Data model (`core/prisma/schema.prisma`)

The award system "starts from zero" and standardizes on the **`uid`** field (the Nexus user id string). A migration-in-progress `uidNew`/`uid_new` column exists on wallet/award/txlog tables ("uid will be deprecated in favor of uidNew … kept for backward compatibility"), but **all current code uses `uid` only**.

- **`UserWallet`** (`user_wallets`) — `id`, `uid` (unique, nullable), `uidNew` (unique, nullable), `address`, timestamps. Upserted lazily on first award/spend/snapshot.
- **`AwardRule`** — `id` (uuid), `eventId` (e.g. `first_login`), `source` (Community/Dashboard/Guru…), `relativeValue`, `rewardAmount`, `maxPerUser`, `maxPerDay` (0=unlimited). ~39 rules seeded in `core/prisma/seed/seed_award_rule.ts`.
- **`UserAward`** (`user_awards`) — per-user per-rule counter: `uid`/`uidNew`, `awardRuleId`, `count`. Unique `(uid, awardRuleId)`. Enforces `maxPerUser`.
- **`TxLog`** (`tx_log`) — on-chain action ledger: `uid`/`uidNew`, `address`, `type` (`award`|`spend`), `eventId`, `label`, `amount` (Decimal), `txHash`, `chainId`, `eventTimestamp`, `source`, `createdAt`. Drives daily caps + wallet history.
- **`File`** + local **`User`/`Role`/`Permission`** (`PermissionEnum`) + vestigial enum `AwardRuleId { FIRST_LOGIN, TEST_EVENT }`.

**No badge / leaderboard models** — "points" are on-chain ENCOIN balances.

### Award-grant business logic (`AwardService.awardEvent`)
1. Resolve `uid = targetUserId`; look up rule by `eventId` (404 if unknown).
2. Verify user exists in Nexus via `AuthService.userExists(uid, componentToken)` (404 if not).
3. Derive EVM address; open a Prisma `$transaction`:
   - Upsert `UserWallet`.
   - Enforce `maxPerDay` (TxLog count for event today).
   - Enforce global `DAILY_TOKEN_CAP` (5) unless event ∈ `EXEMPT_AWARD_EVENTS` (`scan_property`).
   - Enforce `maxPerUser` (`UserAward.count`).
   - `ChainService.award(address, amountWei)` (mint on-chain, await confirmation), increment `UserAward.count`, write `TxLog`, read new balance.
4. Return `{ txHash, awarde_amount, new_balance }`.

## 7. Integration with Nexus

See shared details in `energenius-nexus/ANALYSIS.md → A.2/A.3/A.4`. Award-specific touchpoints (env: `NEXUS_URL`, `TOKEN_INTROSPECTION_URL`; dev defaults `http://host.docker.internal:3003`):

**A. Token introspection (EN-215) — authentication & identity.** `core/src/auth/guards/introspectToken.guard.ts` is a global guard; for every non-`@Public` request it POSTs `{ token }` to `TOKEN_INTROSPECTION_URL`, rejects unless `active === true`, and attaches the payload to `request.user`. Downstream reads identity from **`request.user.nexus_user_id`** — this is the `uid` used everywhere.

**B. Component authorization for award events.** Award granting is machine-to-machine:
- `POST /v1/award/event` uses **`IsComponentGuard`** — allows only components (`token_type === 'COMPONENT'`, or `component_role`, or a client-credentials token: `azp` set, no `email`/`sid`).
- The payload identifies the **recipient** via `target_user_id` (`EventDto`, `@Expose({ name: 'target_user_id' })`; added in **EN-201**). The calling component authenticates as itself but awards a different user.
- The controller forwards the component bearer token to `AwardService`, which calls Nexus **`GET {NEXUS_URL}/auth/users/{uid}/exists`** (Bearer componentToken) to confirm the recipient is real before minting.

**Identity model:** award recipients are pure Nexus `uid` strings; the award system holds no user profile — only a derived custodial wallet address, per-rule counts, and a tx ledger, all keyed by `uid`.

> **Commit history** for the Award System lives in its own file: [`COMMIT_HISTORY.md`](./COMMIT_HISTORY.md).

## 8. Notable caveats (for accuracy)
- Response key typo: service returns `awarde_amount` / `new_balance` while Swagger declares `awardedAmount` / `newBalance`.
- `frontend/src/api/awardApi.ts` posts `{ uid, eventId }`, but the backend DTO expects `{ event_id, target_user_id }` — the sandbox UI is out of sync with the component-oriented contract.
- `AwardService.spend` and `dto/uid.dto.ts` type `uid` as the `AwardRuleId` enum — a mis-typing (uid is a Nexus string); functionally the string flows through.
- `frontend/` is a demo/sandbox harness; the production consumer of the award API is other Nexus components, not this UI.

---
*Generated automatically from code and git history analysis (May–Jul 2026). Shared architecture: see `energenius-nexus/ANALYSIS.md → Part A`.*
