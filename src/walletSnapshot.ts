import { pool } from "./db.js";
import { deriveAddress } from "./wallet.js";
import { balanceOf } from "./chain.js";

export type WalletHistoryItem = {
  type: "award" | "spend";
  eventId: string | null;
  label: string | null;
  amountWei: string;
  txHash: string;
  createdAt: string;
};

export async function getWalletSnapshot(uid: string) {
  if (!uid || uid.trim() === "") throw new Error("uid is required");

  const address = deriveAddress(uid);

  // ensure wallet row exists for FK consistency (idempotent)
  await pool.query(
    `
    INSERT INTO user_wallets (uid, address)
    VALUES ($1, $2)
    ON CONFLICT (uid) DO NOTHING
    `,
    [uid, address]
  );

  const balWei = await balanceOf(address);

  const res = await pool.query(
    `
    SELECT type, event_id, label, amount, tx_hash, created_at
    FROM tx_log
    WHERE uid = $1
    ORDER BY created_at DESC
    LIMIT 10
    `,
    [uid]
  );

  const history: WalletHistoryItem[] = res.rows.map((r: any) => ({
    type: r.type,
    eventId: r.event_id ?? null,
    label: r.label ?? null,
    amountWei: String(r.amount),
    txHash: r.tx_hash,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  return {
    uid,
    address,
    balanceWei: balWei.toString(),
    history,
  };
}
