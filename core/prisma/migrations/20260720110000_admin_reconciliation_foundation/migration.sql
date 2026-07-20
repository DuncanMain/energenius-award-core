-- Durable chain operation state, reconciliation metadata, and Nexus-backed
-- local administration. Existing partner-facing API tables remain compatible.
CREATE TYPE "ChainOperationStatus" AS ENUM ('RESERVED', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "ChainOperationType" AS ENUM ('AWARD', 'SPEND');
CREATE TYPE "AdminPermissionEnum" AS ENUM ('ADMIN_DASHBOARD_VIEW', 'ADMIN_WALLET_READ', 'ADMIN_TRANSACTION_READ', 'ADMIN_TRANSACTION_RECONCILE', 'ADMIN_AWARD_RULE_READ', 'ADMIN_AWARD_RULE_CREATE', 'ADMIN_AWARD_RULE_UPDATE', 'ADMIN_AWARD_RULE_DISABLE', 'ADMIN_TREASURY_READ', 'ADMIN_CONTRACT_PAUSE', 'ADMIN_CONTRACT_UNPAUSE', 'ADMIN_SYSTEM_HEALTH_READ', 'ADMIN_AUDIT_READ', 'ADMIN_ACCESS_MANAGE');

ALTER TABLE "AwardRule" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tx_log"
  ADD COLUMN "status" "ChainOperationStatus" NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN "block_number" BIGINT,
  ADD COLUMN "block_hash" TEXT,
  ADD COLUMN "log_index" INTEGER,
  ADD COLUMN "confirmed_at" TIMESTAMP(3),
  ADD COLUMN "last_checked_at" TIMESTAMP(3),
  ADD COLUMN "failure_reason" TEXT;

CREATE TABLE "chain_operations" (
  "id" TEXT NOT NULL,
  "uid" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "type" "ChainOperationType" NOT NULL,
  "award_rule_id" TEXT,
  "event_id" TEXT,
  "label" TEXT,
  "amount" DECIMAL(65,30) NOT NULL,
  "source" TEXT,
  "event_timestamp" TIMESTAMP(3),
  "status" "ChainOperationStatus" NOT NULL DEFAULT 'RESERVED',
  "tx_hash" TEXT,
  "chain_id" INTEGER NOT NULL,
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "confirmed_at" TIMESTAMP(3),
  CONSTRAINT "chain_operations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "chain_operations_uid_created_at_idx" ON "chain_operations"("uid", "created_at");
CREATE INDEX "chain_operations_status_updated_at_idx" ON "chain_operations"("status", "updated_at");
CREATE UNIQUE INDEX "chain_operations_chain_id_tx_hash_key" ON "chain_operations"("chain_id", "tx_hash");

CREATE TABLE "user_daily_award_locks" (
  "id" TEXT NOT NULL,
  "uid" TEXT NOT NULL,
  "award_date" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_daily_award_locks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_daily_award_locks_uid_award_date_key" ON "user_daily_award_locks"("uid", "award_date");

CREATE TABLE "chain_sync_cursors" (
  "chain_id" INTEGER NOT NULL,
  "contract_address" TEXT NOT NULL,
  "last_processed_block" BIGINT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chain_sync_cursors_pkey" PRIMARY KEY ("chain_id")
);

CREATE TABLE "admin_principals" (
  "id" TEXT NOT NULL,
  "nexus_subject" TEXT NOT NULL,
  "display_name" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "permissions" "AdminPermissionEnum"[] NOT NULL DEFAULT ARRAY[]::"AdminPermissionEnum"[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admin_principals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_principals_nexus_subject_key" ON "admin_principals"("nexus_subject");

CREATE TABLE "admin_audit_log" (
  "id" TEXT NOT NULL,
  "actor_nexus_subject" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT,
  "before" JSONB,
  "after" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "admin_audit_log_actor_nexus_subject_created_at_idx" ON "admin_audit_log"("actor_nexus_subject", "created_at");
CREATE UNIQUE INDEX "tx_log_chain_id_tx_hash_log_index_key" ON "tx_log"("chain_id", "tx_hash", "log_index");
CREATE INDEX "tx_log_status_created_at_idx" ON "tx_log"("status", "created_at");
