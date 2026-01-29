import { pool } from "./db.js";
import { deriveAddress } from "./wallet.js";
import { getAwardRuleById } from "./awardTable.js";
import { award, balanceOf, getChainId, spend as chainSpend } from "./chain.js";
import { parseUnits } from "ethers";

export class AwardCoreError extends Error {
  constructor(
    public code:
  | "VALIDATION_ERROR"
  | "UNKNOWN_ACTION"
  | "MAXCOUNT_EXCEEDED"
  | "INSUFFICIENT_BALANCE"
  | "INTERNAL_ERROR",
    message: string
  ) {
    super(message);
  }
}

export async function awardEvent(
  uid: string,
  eventId: string,
  opts?: {
    timestamp?: string;
    source?: string;
  }
) {
  let eventTimestamp: Date | null = null;

  if (opts?.timestamp) {
    const d = new Date(opts.timestamp);
    if (isNaN(d.getTime())) {
      throw new AwardCoreError("VALIDATION_ERROR", "Invalid timestamp");
    }
    eventTimestamp = d;
  }

  // existing validation continues here...

  if (!uid || uid.trim() === "") throw new AwardCoreError("VALIDATION_ERROR", "uid is required");
  if (!eventId || eventId.trim() === "")
    throw new AwardCoreError("VALIDATION_ERROR", "eventId is required");

  const rule = getAwardRuleById(eventId);
  if (!rule) throw new AwardCoreError("UNKNOWN_ACTION", `Unknown eventId: ${eventId}`);

  const address = deriveAddress(uid);
  const amountWei = BigInt(parseUnits(rule.encAmount, 18).toString());
  const chainId = getChainId();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure user_wallets exists
    await client.query(
      `
      INSERT INTO user_wallets (uid, address)
      VALUES ($1, $2)
      ON CONFLICT (uid) DO NOTHING
      `,
      [uid, address]
    );

    // Ensure award counter row exists
    await client.query(
      `
      INSERT INTO user_awards (uid, event_id, count)
      VALUES ($1, $2, 0)
      ON CONFLICT (uid, event_id) DO NOTHING
      `,
      [uid, eventId]
    );

    // Lock row to prevent double-awards
    const { rows } = await client.query(
      `
      SELECT count
      FROM user_awards
      WHERE uid = $1 AND event_id = $2
      FOR UPDATE
      `,
      [uid, eventId]
    );

    const currentCount = Number(rows[0]?.count ?? 0);
    const maxCount = Number(rule.maxCount);
    const unlimited = maxCount === 0;

    if (!unlimited && currentCount >= maxCount) {
      throw new AwardCoreError("MAXCOUNT_EXCEEDED", "maxCount reached for this award");
    }

    // On-chain award (waits confirmation inside chain.ts)
    const txHash = await award(address, amountWei);

    // Persist DB state
    await client.query(
      `
      UPDATE user_awards
      SET count = count + 1,
          updated_at = NOW()
      WHERE uid = $1 AND event_id = $2
      `,
      [uid, eventId]
    );

    await client.query(
  `
  INSERT INTO tx_log (
    uid,
    address,
    type,
    event_id,
    label,
    amount,
    tx_hash,
    chain_id,
    event_timestamp,
    source
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `,
  [
    uid,
    address,
    "award",
    eventId,
    rule.title,
    amountWei.toString(),
    txHash,
    80002,
    eventTimestamp,
    opts?.source ?? null
  ]
);


    await client.query("COMMIT");

    const newBalanceWei = await balanceOf(address);

    return {
  txHash,
  address,
  newBalanceWei,
};

  } catch (e: any) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    if (e instanceof AwardCoreError) throw e;
    throw new AwardCoreError("INTERNAL_ERROR", e?.message ?? "Unknown error");
  } finally {
    client.release();
  }
}

export async function spend(uid: string, amountEnc: string, label?: string) {
  if (!uid || uid.trim() === "") throw new AwardCoreError("VALIDATION_ERROR", "uid is required");
  if (!amountEnc || amountEnc.trim() === "")
    throw new AwardCoreError("VALIDATION_ERROR", "amount is required");

  // Convert whole-token string -> wei (18 decimals)
  const amountWei = BigInt(parseUnits(amountEnc, 18).toString());
  if (amountWei <= 0n) throw new AwardCoreError("VALIDATION_ERROR", "amount must be > 0");

  const address = deriveAddress(uid);
  const chainId = getChainId();

  // Ensure wallet exists (FK for tx_log)
  await pool.query(
    `
    INSERT INTO user_wallets (uid, address)
    VALUES ($1, $2)
    ON CONFLICT (uid) DO NOTHING
    `,
    [uid, address]
  );

  // Check on-chain balance before spending
  const bal = await balanceOf(address);
  if (bal < amountWei) {
  throw new AwardCoreError("INSUFFICIENT_BALANCE", "insufficient balance");
}

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const txHash = await chainSpend(address, amountWei);

    await client.query(
      `
      INSERT INTO tx_log
        (uid, address, type, event_id, label, amount, tx_hash, chain_id)
      VALUES
        ($1,  $2,      'spend', NULL,    $3,    $4,     $5,     $6)
      `,
      [uid, address, label ?? null, amountWei.toString(), txHash, chainId]
    );

    await client.query("COMMIT");

    const newBalanceWei = await balanceOf(address);

    return { txHash, address, newBalanceWei };
  } catch (e: any) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    if (e instanceof AwardCoreError) throw e;
    throw new AwardCoreError("INTERNAL_ERROR", e?.message ?? "Unknown error");
  } finally {
    client.release();
  }
}

