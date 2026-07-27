# PR #46 — "Add ENERGENIUS administrator dashboard" — review & analysis

> Reviewed 2026-07-25. Branch `agent/admin-dashboard` → `main`, one squashed commit
> (`fb95d197`), **DRAFT**, 60 files, **+4887 / −556**, mergeable. Author: Duncan Main.
> Analysis by reading the full diff plus the base tree; no code was changed by this review.

## TL;DR / verdict

A large, **well-architected** feature: a Nexus-`sub`-based local admin dashboard on top of a new
**durable chain-operation state machine**, scheduled **blockchain→Postgres reconciliation**, audited
manual balance operations, contract pause/treasury/health, and a Next.js admin UI with an
HttpOnly-cookie session proxy. Backward compatibility is taken seriously (partner routes/payloads
unchanged, component-source matching **observation-only by default**, the ENcoin contract is **not**
modified — the ABI is only widened).

**But it is a DRAFT and should not merge to prod as-is.** There are a handful of real correctness
bugs (one of them the *same class* as the `/v1/wallet` 500 we just fixed), a timezone bug in the
daily-cap accounting, reconciliation that is not multi-replica safe and never catches up with its
default config, no tests on the highest-risk new code (reconciliation), and a **merge conflict with
our in-flight `/wallet` fix**. Recommendation: **request changes** (fix H1–H5, set the sync start
block, add reconciliation tests, coordinate the `/wallet` fix), then merge.

---

## 1. What the PR adds (inventory)

**Backend (`core/`, NestJS):**
- **`admin/` module** (new): `admin.service.ts` (785 lines), `admin.controller.ts` (395), `admin.dto.ts`,
  `admin.guard.ts` + spec, `admin-bootstrap.service.ts`, `admin-permissions.decorator.ts`, `admin.module.ts`.
- **`reconciliation/` module** (new): `chain-reconciliation.service.ts` (192), `reconciliation.module.ts`.
- **`award/award.service.ts`** rewritten (+296/−53): daily counting, supplied-timestamp, two-phase
  chain execution with per-user + per-signer locks.
- **`chain/chain.service.ts`** (+106/−31): treasury/paused/metadata/health, pause/unpause,
  submit+wait split, `transferEvents`. `chain/abi/encoin.abi.json` widened.
- **`prisma/schema.prisma`** (+228) + **2 migrations** (durable ops, admin, policies).
- Wiring: `app.module` (ScheduleModule, Admin/Reconciliation modules), `main.ts` (Swagger include),
  `package.json` (`postinstall: prisma generate`), env examples, prod compose.

**Frontend (`frontend/`, Next.js App Router):**
- `admin/AdminDashboard.tsx` (1082) + `admin/page.tsx`; admin proxy `api/admin/[...path]/route.ts` +
  `preview.ts` (304, mock layer); session `api/session/login|logout`; login/home rewired.
- **Retired demo wallet frontend removed** (`wallet/WalletPageContent.tsx`, `wallet/page.tsx`).

---

## 2. Data model & migrations

Two additive migrations (`20260720110000_admin_reconciliation_foundation`,
`20260720140000_admin_dashboard`). No columns renamed/removed. Highlights:

- **`chain_operations`** — the durable state machine. `status` RESERVED→SUBMITTED→CONFIRMED / FAILED /
  RECONCILIATION_REQUIRED; unique `idempotency_key`; unique `(chain_id, tx_hash)`; carries admin
  provenance (`admin_subject`, `reason`, `internal_reference`, `original_tx_log_id`).
- **`user_daily_award_locks`** unique `(uid, award_date)` — the per-user/day concurrency lock row.
- **`chain_sync_cursors`** — reconciliation cursor per chain.
- **`admin_principals`** unique `nexus_subject` + `permissions AdminPermissionEnum[]`; **`admin_audit_log`** (append-only).
- **`token_policies`** (global `daily_cap=5`, `reset_basis=UTC_DAY`) — configurable cap.
- **`component_source_mappings` / `_policies` (enforce=false) / `_observations`** — observation-only source matching.
- **`rejected_award_requests`** — audit of rejected awards.
- `tx_log` gains block metadata + `status` (default CONFIRMED) + admin provenance; unique `(chain_id, tx_hash, log_index)`.
- `AwardRule` gains `enabled`, `display_name`, `retired_at`, `global_cap_exempt` (+ sets `scan_property` exempt), `created_by/updated_by`, and a **unique index on `eventId`** (migration preflight aborts if duplicates exist — good).

**Migration notes:**
- Migration 2 uses `ALTER TYPE … ADD VALUE IF NOT EXISTS` for 7 enum values. It does **not** use those
  values in the same migration, so it is safe on PG 12+ (repo runs postgres:17). ✔
- `ChainOperation.status` default **is** `RESERVED` in `schema.prisma` (the award pending-accounting
  depends on this) — verified. ✔
- Rollback is explicitly documented as *not* reversing migrations (additive; keep the DB). ✔

---

## 3. Admin module — auth model & API

**AuthZ (fail-closed, sound):**
- Global Nexus `IntrospectionGuard` populates `request.user`; **`AdminGuard`** then loads
  `admin_principals` by `request.user.sub` (fallback `nexus_user_id`), requires `enabled`, and requires
  **every** `@RequireAdminPermissions(...)` on the handler. Missing subject / principal / permission →
  `ForbiddenException`. ✔
- **`AdminBootstrapService`**: on boot, upserts each `ADMIN_NEXUS_SUBJECTS` (comma-separated) as an
  admin with **all** permissions — the initial bootstrap. Nexus itself is unchanged.
- Every mutating endpoint carries a permission decorator (verified for adjustments, reward-events,
  token-rules, component-sources, administrators, reconciliation, pause/unpause). So the dashboard's
  client-side gating is **UX only**; the real boundary is server-side and present. ✔

**API surface (`/v1/admin/*`, all guarded):** `me`, `overview`, `users`, `users/:id`, `transactions`,
`reward-events` (GET/POST/PATCH), `token-rules` (GET/PATCH), `component-sources` (GET/POST/PATCH),
`adjustments` (POST), `administrators` (GET/POST/PATCH), `audit`, `system/health`,
`reconciliation/run` (POST), `contract/pause|unpause` (POST).

**Nice safety touches:** pause/unpause require **both** the permission **and** an exact
`x-admin-confirmation: PAUSE ENCOIN` header; `adjust` requires a typed
`CONFIRM <type> <amount> ENC` string; `updateAdmin` refuses to remove the **last** access-manager or
your own access; contract **ownership transfer/renounce are deliberately not exposed**.

**The `adjust()` money-path** (manual credit/debit/correction/refund) is the most careful code in the
PR: idempotency-key short-circuit → wallet lookup → treasury sufficiency check for credits →
`pg_advisory_xact_lock` per user → overdraft check *including in-flight debits* → create RESERVED op →
second txn with `pg_advisory_xact_lock('energenius-treasury-signer')` (nonce serialization, **shared
with the award path**) → submit → wait → write CONFIRMED tx_log + op. On error: RECONCILIATION_REQUIRED
if a tx was submitted, else FAILED. `amount` is validated `@IsInt() @Min(1)` (integer ENC), so the
float-precision worry is minimal.

---

## 4. Award logic changes (`award.service.ts`)

**Genuine fixes:** supplied `timestamp` is now parsed/validated (base declared `eventTimestamp=null`
and never assigned — every award stored `null`); `/available` `today_count` now keys off
`rule.eventId` (base used `rule.id`, so it was always 0); `spend()` uid type fixed (was an enum).
Two-phase execution with a `user_daily_award_locks` `FOR UPDATE` row lock + RESERVED-pending
accounting correctly serializes concurrent award decisions per user/day.

**Backward compat:** `POST /v1/award/event` and `GET /v1/award/available` keep their request/response
shapes. Behavioral deltas to announce: (a) a **malformed `timestamp` now 400s** (was silently
dropped); (b) `enabled=false` rules are rejected / reported unavailable; (c) `today_count` is now correct.

---

## 5. Chain & reconciliation

- **Contract not modified.** ABI only *adds* views/events (`treasury`, `paused`, `name/symbol/decimals/
  totalSupply`, `pause/unpause`, `Transfer/Paused/Unpaused`). It is a Pausable ERC20-ish token with a
  `treasury` role and custom `award`/`spend`; no standard `transfer`/`approve`, no `mint` in ABI.
- **`balanceOf` is unchanged** — so the `/v1/wallet` 500-on-dead-RPC is **not** fixed here (see §9).
- **Reconciliation** (`@Cron` every 30s, gated by `CHAIN_SYNC_ENABLED!=='false'`): reads confirmed
  `Transfer` events in one `CHAIN_SYNC_CHUNK_SIZE` (1000) block chunk per tick from a cursor, writes
  `tx_log`/`chain_operation`/`user_awards`, then re-checks submitted ops. Bounded per run (no unbounded
  loop). Award/spend direction is **inferred** from `Transfer` vs `treasury()` (no dedicated events).

---

## 6. Frontend & session proxy

- **Session:** `POST /api/session/login` authenticates against Nexus server-side, **then verifies
  admin enrollment via core `/admin/me`** before issuing the cookie (non-admins get no session — good).
  Cookie `eg_admin_token`: `HttpOnly`, `Secure` (prod), `SameSite=strict`, 8h. **It stores the raw
  Nexus bearer JWT** (not an opaque session id); logout only drops the cookie and **does not revoke the
  token upstream**.
- **Admin proxy** `api/admin/[...path]`: requires the cookie (401 otherwise), forwards only
  `authorization`/`content-type`/`x-admin-confirmation`, copies back only status + content-type (no
  cookie leakage), exports GET/POST/PATCH only. Target host is fixed from env → **no arbitrary-host
  SSRF**. Secondary CSRF `Origin` check (SameSite=strict is the real defense).
- **`preview.ts`**: static mock layer, **mutations are no-ops**, backend never contacted; reachable only
  when `ADMIN_PREVIEW_MODE==='true'` + sentinel cookie. Defaults **false** in `.env.lexample` and prod
  compose. Safe by construction, but must stay off in prod.
- **Demo wallet removal** is clean at the import/routing level (`/` and `/login` redirect to `/admin`).
  (Orphaned demo components/hooks are left in the tree as dead code — cosmetic.)

---

## 7. Bugs & risks (prioritized)

### High — fix before merge
- **H1 · `balanceOf`-after-confirm poisons a confirmed operation.** In `awardEvent`, `spend`, and
  admin `adjust`, the final `chain.balanceOf(...)` (for the returned `new_balance`) runs **inside the
  `try` after** the on-chain tx already confirmed and the DB already wrote CONFIRMED. If that read
  throws (dead/slow RPC), the `catch` overwrites the op to `RECONCILIATION_REQUIRED` and rethrows — a
  fully successful award/adjustment is reported to the partner as an error and flagged for
  reconciliation. **Same class as the `/v1/wallet` 500.** Fix: move the trailing `balanceOf`/return out
  of the `try` (or make it best-effort).
- **H2 · Timezone-inconsistent daily counting.** The confirmed per-event count
  (`countTodayByUidAndAwardRuleId`) uses **local-server-midnight**, while pending counts, the token-cap
  total (`sumTodayAwardsByUid`), and `/available` use **UTC midnight**. If the server TZ ≠ UTC, the two
  halves of the same cap use different day boundaries → miscounts near midnight (can over- or
  under-award). Unify to UTC.
- **H3 · Reconciliation is not multi-replica safe.** Concurrency is guarded only by an **in-process**
  `this.running` flag. With >1 core replica, both run the 30s cron over the same block range → racing
  `tx_log.create` → `P2002` → the run aborts and the **cursor stalls**. Needs a DB advisory lock /
  leader election, or the service must be documented and enforced as single-instance. **Confirm the
  prod topology.**
- **H4 · Reconciliation multi-log idempotency bug.** `tx_log` unique key is
  `(chain_id, tx_hash, log_index)`, but `reconcileTransfer` looks up existing rows with
  `findFirst({ chainId, txHash })` — **omits `log_index`**. A tx emitting multiple relevant `Transfer`
  logs collapses into one row (overwrites), under-counting. Include `logIndex` in the lookup.
- **H5 · Orphaned RESERVED/SUBMITTED ops block the user forever.** The two-phase design commits a
  RESERVED op before submitting; a crash between phases leaves a pending row that counts against
  `maxPerDay`/`maxPerUser`/the cap **permanently**, so the user silently stops earning. No TTL/reaper in
  scope. Add a sweep that expires stale RESERVED/SUBMITTED ops (and reconciles or fails them).

### Medium
- **M1 · Reconciliation never catches up with defaults.** 1000 blocks / 30s ≈ 2M/day vs Amoy's tens of
  millions, and `CHAIN_SYNC_START_BLOCK` defaults to **0**. Prod **must** set the contract deployment
  block (README says so, but the default is a foot-gun).
- **M2 · Concurrent duplicate `idempotencyKey` → unhandled `P2002` 500.** Idempotency is correct for
  sequential retries but two simultaneous identical requests both pass the `existing` check and one
  hits the unique constraint uncaught. Catch P2002 and return the existing op.
- **M3 · Proxy path-scope bypass.** `[...path]` segments are joined without normalizing `..`, so an
  authenticated admin can escape the `/admin/` prefix to other same-host core endpoints under their own
  token (no arbitrary-host SSRF; own privileges only). Reject segments containing `..`.
- **M4 · No `tx.wait()` timeout** on pause/unpause/confirm helpers → can hang indefinitely if a tx
  never mines.
- **M5 · `treasury()` called once per Transfer event** in reconciliation → N RPC round-trips per chunk.
  Cache per run.
- **M6 · Reconciliation confirmation gap.** If a counterpart wallet isn't in `user_wallets`, the op is
  never marked CONFIRMED (stuck), and `receipt === null` (dropped tx) isn't handled by
  `recheckSubmittedOperations`.
- **M7 · Test coverage of the riskiest code is ~zero.** No `chain-reconciliation.service.spec.ts` at
  all; award concurrency/limit/error paths and the entire rewritten `spend()` are untested;
  `chain.service.spec` stays trivial (`should be defined`). Per the repo's unit+e2e convention this is
  out of compliance for the new surface.
- **M8 · `/wallet` 500 not fixed + spec conflict.** See §9.

### Low / observations
- **L1** Cookie holds the **raw Nexus bearer JWT**; **logout doesn't revoke upstream** — a captured
  token outlives "logout" until JWT expiry. Consider an opaque/wrapped session or short TTL + upstream
  revoke.
- **L2** CSRF `Origin` check skips a null/absent `Origin` (SameSite=strict still covers it).
- **L3** `ADMIN_PREVIEW_MODE` / `NEXT_PUBLIC_ADMIN_PREVIEW_MODE` must stay **false** in prod (defaults
  are false — verified).
- **L4** Write amplification: every award with a component identity does a singleton
  `componentSourcePolicy.upsert` **and** inserts a `component_source_observation`; every rejected award
  inserts a row. Unbounded telemetry growth — add pruning/retention.
- **L5** `CHAIN_CONFIRMATIONS`: README says default 5, but `.env.example` and prod compose set **1**
  (faster indexing, weaker reorg safety). Reconcile the docs vs config.
- **L6** Orphaned demo components/hooks left in the tree after the wallet-frontend removal (dead code).
- **L7** Hardcoded prod Nexus hostname as a frontend env fallback.

### Verified NON-issues (raised during review, then cleared)
- ~~Core `AdminPermissionEnum` missing `ADMIN_TOKEN_RULE_MANAGE` / `ADMIN_BALANCE_ADJUST`~~ — **false
  alarm.** Migration 1 creates 14 values; **migration 2 adds those two** via `ALTER TYPE … ADD VALUE`,
  and `schema.prisma` lists all 16. Consistent.
- "All dashboard authorization is client-side" — the UI gating is cosmetic, but **core enforces** every
  mutating endpoint via `@RequireAdminPermissions` (verified). Correct by design.

---

## 8. Strengths (credit where due)

Durable idempotent state machine; idempotency keys; advisory locks for per-user serialization **and**
per-signer nonce (shared across award + admin, so no nonce collision between the two paths); typed
double-confirmations for destructive ops; fail-closed RBAC; append-only audit on every mutation;
observation-only source matching (`enforce=false`) so existing partners can't be disrupted; contract
untouched; ownership transfer/renounce intentionally not exposed; additive migrations with a duplicate-
eventId preflight and documented rollback; `postinstall: prisma generate` (fixes the client-not-
generated papercut). This is a serious, thoughtful piece of work.

---

## 9. Coordination with our in-flight `/wallet` fix

- The PR **does not** fix the `/v1/wallet` 500 (chain `balanceOf` is byte-for-byte unchanged), and it
  even **touches the same two spec files** our fix rewrote (`wallet.service.spec.ts`,
  `wallet.controller.spec.ts`) — the PR just adds empty mock providers to make `should be defined` pass,
  whereas our fix rewrites them with the graceful-degrade tests. **→ merge conflict on those two files.**
- Our `getWallet` graceful-degrade fix is the correct resolution and also **fixes H1's sibling** on the
  wallet path. Recommended: land the PR with our `wallet.service.ts` degrade change layered in (keep our
  spec versions), and apply the same "don't 500 on a post-confirm chain read" pattern to `awardEvent` /
  `spend` / `adjust` (H1).

---

## 10. Deployment considerations (from the PR's own docs + review)

Order: back up Postgres → build images → `prisma migrate deploy` (aborts on duplicate `eventId`) →
start core, verify `/v1/admin/system/health` as an authorized admin → start frontend, verify Nexus
login + permission-aware nav → run reconciliation, confirm cursor advances → test a known partner
award unchanged. New env: `ADMIN_NEXUS_SUBJECTS` (bootstrap admin `sub`s), `CHAIN_SYNC_ENABLED`,
`CHAIN_CONFIRMATIONS`, `CHAIN_SYNC_CHUNK_SIZE`, **`CHAIN_SYNC_START_BLOCK` (set to the deployment
block!)**. Keep `ADMIN_PREVIEW_MODE=false`. Frontend proxy: `CORE_API_URL`, `NEXUS_API_URL`.

---

## 11. Recommendation — what to do

**Request changes; do not merge to prod as-is.** Ask the author to:

1. **H1** — move the trailing `balanceOf`/return out of the `try` in `awardEvent`, `spend`, `adjust`
   (and adopt our `/wallet` degrade fix).
2. **H2** — unify daily-window boundaries to UTC (`countTodayByUidAndAwardRuleId`).
3. **H3** — make reconciliation a singleton (DB advisory lock / leader election) or document+enforce
   single-instance; confirm prod replica count.
4. **H4** — include `logIndex` in the reconciliation `tx_log` lookup.
5. **H5** — add a reaper for stale RESERVED/SUBMITTED ops.
6. **M1** — set `CHAIN_SYNC_START_BLOCK` to the contract deployment block in prod config.
7. **M2/M3** — catch `P2002` on duplicate idempotency key; reject `..` in the proxy path.
8. **M7** — add unit tests for `ChainReconciliationService` (direction inference, idempotent re-run,
   RPC-down, revert→FAILED) and for the award concurrency/limit/error paths; add an e2e happy-path for
   the admin surface (per our standing unit+e2e rule).

Then it's a strong merge. The design is sound; the blockers are a few correctness bugs, reconciliation
robustness, and test coverage — all fixable without rearchitecting.

---

### Appendix — files changed (60)

Backend admin (8 new), reconciliation (2 new), award (7), chain (3), prisma schema + 2 migrations + 2
seeds, app wiring (app.module/main.ts/package.json/prisma.config/eslint), env/README/compose (7);
frontend admin dashboard + proxy + preview + session (8 new/changed), login/home/layout/globals,
**wallet frontend deleted (2)**.
</content>
</invoke>
