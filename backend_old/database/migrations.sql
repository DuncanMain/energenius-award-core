-- ENERGENIUS Database Schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid VARCHAR(255) UNIQUE NOT NULL,
  wallet_id VARCHAR(255) UNIQUE NOT NULL,
  address VARCHAR(255) NOT NULL,
  balance DECIMAL(20, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallets_uid ON wallets(uid);
CREATE INDEX IF NOT EXISTS idx_wallets_wallet_id ON wallets(wallet_id);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_id VARCHAR(255) UNIQUE NOT NULL,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')),
  amount DECIMAL(20, 2) NOT NULL,
  description TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_id ON transactions(tx_id);

CREATE TABLE IF NOT EXISTS award_rules (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  enc_amount DECIMAL(10, 2) NOT NULL,
  max_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_award_rules_event ON award_rules(event_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE
ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();