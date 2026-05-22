/*
  Warnings:

  - A unique constraint covering the columns `[uid_new]` on the table `user_wallets` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "tx_log" ADD COLUMN     "uid_new" TEXT,
ALTER COLUMN "uid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user_awards" ADD COLUMN     "uid_new" TEXT,
ALTER COLUMN "uid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user_wallets" ADD COLUMN     "uid_new" TEXT,
ALTER COLUMN "uid" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_wallets_uid_new_key" ON "user_wallets"("uid_new");
