CREATE TABLE IF NOT EXISTS user_wallets (
  uid TEXT PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_awards (
  uid TEXT NOT NULL,
  event_id TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (uid, event_id),
  CONSTRAINT fk_user_awards_uid
    FOREIGN KEY (uid) REFERENCES user_wallets(uid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tx_log (
  id BIGSERIAL PRIMARY KEY,
  uid TEXT NOT NULL,
  address TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('award', 'spend')),
  event_id TEXT NULL,
  label TEXT NULL,
  amount NUMERIC(78, 0) NOT NULL,
  tx_hash TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  source TEXT NULL,
  event_timestamp TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_tx_log_uid
    FOREIGN KEY (uid) REFERENCES user_wallets(uid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tx_log_uid_created_at ON tx_log (uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_log_tx_hash ON tx_log (tx_hash);
