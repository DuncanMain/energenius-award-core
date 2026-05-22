/*
  Warnings:

  - A unique constraint covering the columns `[uid_new,award_rule_id]` on the table `user_awards` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "user_awards_uid_new_award_rule_id_key" ON "user_awards"("uid_new", "award_rule_id");
