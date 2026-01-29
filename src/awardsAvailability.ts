import { pool } from "./db.js";
import { deriveAddress } from "./wallet.js";
import { listAwardRules, type AwardRule } from "./awardTable.js";

export type AwardAvailabilityItem = {
  id: string;
  title: string;
  encAmount: string;
  maxCount: number;          // 0 = unlimited
  awardedCount: number;      // from user_awards
  remaining: number | null;  // null when unlimited
  isAvailable: boolean;
};

export async function getAvailableAwardsForUser(uid: string): Promise<AwardAvailabilityItem[]> {
  if (!uid || uid.trim() === "") throw new Error("uid is required");

  const address = deriveAddress(uid);

  // ensure wallet row exists (FK consistency)
  await pool.query(
    `
    INSERT INTO user_wallets (uid, address)
    VALUES ($1, $2)
    ON CONFLICT (uid) DO NOTHING
    `,
    [uid, address]
  );

  const res = await pool.query(
    `
    SELECT event_id, count
    FROM user_awards
    WHERE uid = $1
    `,
    [uid]
  );

  const counts = new Map<string, number>();
  for (const r of res.rows as Array<{ event_id: string; count: any }>) {
    counts.set(r.event_id, Number(r.count) || 0);
  }

  const rules: AwardRule[] = listAwardRules();

  return rules.map((rule) => {
    const awardedCount = counts.get(rule.id) ?? 0;

    if (rule.maxCount === 0) {
      return {
        id: rule.id,
        title: rule.title,
        encAmount: rule.encAmount,
        maxCount: rule.maxCount,
        awardedCount,
        remaining: null,
        isAvailable: true,
      };
    }

    const remaining = rule.maxCount - awardedCount;

    return {
      id: rule.id,
      title: rule.title,
      encAmount: rule.encAmount,
      maxCount: rule.maxCount,
      awardedCount,
      remaining,
      isAvailable: remaining > 0,
    };
  });
}
