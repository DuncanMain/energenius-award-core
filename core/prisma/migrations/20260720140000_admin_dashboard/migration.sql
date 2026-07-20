DO $$ BEGIN
  IF EXISTS (SELECT "eventId" FROM "AwardRule" GROUP BY "eventId" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate AwardRule.eventId values exist; resolve explicitly before migration';
  END IF;
END $$;

ALTER TYPE "ChainOperationType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT_CREDIT';
ALTER TYPE "ChainOperationType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT_DEBIT';
ALTER TYPE "ChainOperationType" ADD VALUE IF NOT EXISTS 'CORRECTION_CREDIT';
ALTER TYPE "ChainOperationType" ADD VALUE IF NOT EXISTS 'CORRECTION_DEBIT';
ALTER TYPE "ChainOperationType" ADD VALUE IF NOT EXISTS 'REFUND';
ALTER TYPE "AdminPermissionEnum" ADD VALUE IF NOT EXISTS 'ADMIN_TOKEN_RULE_MANAGE';
ALTER TYPE "AdminPermissionEnum" ADD VALUE IF NOT EXISTS 'ADMIN_BALANCE_ADJUST';

ALTER TABLE "AwardRule" ADD COLUMN "display_name" TEXT, ADD COLUMN "notes" TEXT,
  ADD COLUMN "comments" TEXT, ADD COLUMN "retired_at" TIMESTAMP(3),
  ADD COLUMN "global_cap_exempt" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "created_by" TEXT, ADD COLUMN "updated_by" TEXT;
UPDATE "AwardRule" SET "global_cap_exempt" = true WHERE "eventId" = 'scan_property';
CREATE UNIQUE INDEX "AwardRule_eventId_key" ON "AwardRule"("eventId");

ALTER TABLE "chain_operations" ADD COLUMN "submitted_at" TIMESTAMP(3),
  ADD COLUMN "idempotency_key" TEXT, ADD COLUMN "admin_subject" TEXT,
  ADD COLUMN "reason" TEXT, ADD COLUMN "internal_reference" TEXT,
  ADD COLUMN "original_tx_log_id" INTEGER, ADD COLUMN "component_identity" TEXT;
CREATE UNIQUE INDEX "chain_operations_idempotency_key_key" ON "chain_operations"("idempotency_key");

ALTER TABLE "tx_log" ADD COLUMN "chain_operation_id" TEXT,
  ADD COLUMN "admin_subject" TEXT, ADD COLUMN "reason" TEXT,
  ADD COLUMN "internal_reference" TEXT, ADD COLUMN "original_tx_log_id" INTEGER;
CREATE INDEX "tx_log_original_tx_log_id_idx" ON "tx_log"("original_tx_log_id");

ALTER TABLE "admin_audit_log" ADD COLUMN "reason" TEXT,
  ADD COLUMN "user_uid" TEXT, ADD COLUMN "event_id" TEXT,
  ADD COLUMN "chain_operation_id" TEXT, ADD COLUMN "tx_log_id" INTEGER;

CREATE TABLE "token_policies" ("id" TEXT NOT NULL DEFAULT 'global', "cap_enabled" BOOLEAN NOT NULL DEFAULT true,
  "daily_cap" INTEGER NOT NULL DEFAULT 5, "reset_basis" TEXT NOT NULL DEFAULT 'UTC_DAY', "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "token_policies_pkey" PRIMARY KEY ("id"));
INSERT INTO "token_policies" VALUES ('global', true, 5, 'UTC_DAY', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "component_source_mappings" ("id" TEXT NOT NULL, "component_identity" TEXT NOT NULL,
  "source" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true, "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "component_source_mappings_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "component_source_mappings_component_identity_source_key"
  ON "component_source_mappings"("component_identity", "source");

CREATE TABLE "component_source_policies" ("id" TEXT NOT NULL DEFAULT 'global', "identity_claim" TEXT NOT NULL DEFAULT 'azp',
  "enforce" BOOLEAN NOT NULL DEFAULT false, "updated_by" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "component_source_policies_pkey" PRIMARY KEY ("id"));
INSERT INTO "component_source_policies" VALUES ('global', 'azp', false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "component_source_observations" ("id" TEXT NOT NULL, "component_identity" TEXT NOT NULL,
  "configured_source" TEXT NOT NULL, "event_id" TEXT NOT NULL, "matched" BOOLEAN NOT NULL,
  "enforced" BOOLEAN NOT NULL DEFAULT false, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "component_source_observations_pkey" PRIMARY KEY ("id"));
CREATE INDEX "component_source_observations_matched_created_at_idx" ON "component_source_observations"("matched", "created_at");

CREATE TABLE "rejected_award_requests" ("id" TEXT NOT NULL, "component_identity" TEXT,
  "target_user_id" TEXT NOT NULL, "event_id" TEXT NOT NULL, "reason_category" TEXT NOT NULL,
  "reason_message" TEXT NOT NULL, "event_timestamp" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rejected_award_requests_pkey" PRIMARY KEY ("id"));
CREATE INDEX "rejected_award_requests_created_at_idx" ON "rejected_award_requests"("created_at");
CREATE INDEX "rejected_award_requests_event_id_created_at_idx" ON "rejected_award_requests"("event_id", "created_at");
