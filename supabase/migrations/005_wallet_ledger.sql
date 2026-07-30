-- ============================================================
-- Orbit Wallet — Ledger & Wallet Schema
-- Foundational append-only double-entry ledger. Wallet balances
-- are always derived from ledger_entries — never a stored column.
-- Run this in your Supabase SQL editor.
--
-- This migration is additive only: it does not touch the existing
-- `payments` table or any collection-side (Paystack/Stripe/
-- Flutterwave) code. Wiring invoice payments into the ledger, and
-- custody via a BaaS partner (Anchor/Mono), are separate follow-ups.
-- ============================================================

-- =============================================
-- WALLETS
-- One per user. Metadata only — no balance column.
-- =============================================
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
  external_account_ref TEXT, -- BaaS partner's virtual account reference, once one exists
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, currency)
);

CREATE INDEX IF NOT EXISTS wallets_user_id_idx ON wallets(user_id);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own wallet"
  ON wallets FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- LEDGER ACCOUNTS
-- The chart of accounts. Every wallet has exactly one user_wallet
-- account; system accounts (wallet_id NULL) are singletons per
-- (type, currency) and make Orbit's own fee revenue etc. just
-- another account, not a special case.
-- =============================================
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'user_wallet',
    'payment_processor_clearing',
    'platform_fee_revenue',
    'payout_clearing',
    'payout_settled',
    'refunds_payable'
  )),
  currency TEXT NOT NULL DEFAULT 'NGN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ledger_accounts_wallet_matches_type CHECK (
    (type = 'user_wallet' AND wallet_id IS NOT NULL) OR
    (type != 'user_wallet' AND wallet_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ledger_accounts_wallet_unique
  ON ledger_accounts(wallet_id) WHERE wallet_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ledger_accounts_system_unique
  ON ledger_accounts(type, currency) WHERE wallet_id IS NULL;

ALTER TABLE ledger_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own ledger account"
  ON ledger_accounts FOR SELECT USING (
    wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid())
  );

-- Seed the system accounts. One row each, NGN to start.
INSERT INTO ledger_accounts (wallet_id, type, currency)
VALUES
  (NULL, 'payment_processor_clearing', 'NGN'),
  (NULL, 'platform_fee_revenue', 'NGN'),
  (NULL, 'payout_clearing', 'NGN'),
  (NULL, 'payout_settled', 'NGN'),
  (NULL, 'refunds_payable', 'NGN')
ON CONFLICT (type, currency) WHERE wallet_id IS NULL DO NOTHING;

-- =============================================
-- LEDGER TRANSACTIONS
-- One row per logical event. Append-only: never updated or
-- deleted. A reversal is a new row referencing the original via
-- reverses_transaction_id, not an edit to it.
-- =============================================
CREATE TABLE IF NOT EXISTS ledger_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL, -- 'invoice_payment', 'withdrawal', 'refund', 'admin_adjustment', ...
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('pending', 'posted', 'reversed')),
  currency TEXT NOT NULL DEFAULT 'NGN',
  reference TEXT, -- e.g. invoice id, withdrawal id, external provider reference
  reverses_transaction_id UUID REFERENCES ledger_transactions(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id), -- set for admin adjustments
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ledger_transactions_reference_idx ON ledger_transactions(reference);
CREATE INDEX IF NOT EXISTS ledger_transactions_reverses_idx ON ledger_transactions(reverses_transaction_id);

ALTER TABLE ledger_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own ledger transactions"
  ON ledger_transactions FOR SELECT USING (
    id IN (
      SELECT le.transaction_id
      FROM ledger_entries le
      JOIN ledger_accounts la ON la.id = le.account_id
      JOIN wallets w ON w.id = la.wallet_id
      WHERE w.user_id = auth.uid()
    )
  );

-- No UPDATE/DELETE policy is defined for the `authenticated` role, and RLS
-- denies by default, so regular users cannot write to this table at all.
-- Only the service role (which bypasses RLS) may insert.

CREATE OR REPLACE FUNCTION forbid_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_transactions_no_mutation
  BEFORE UPDATE OR DELETE ON ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

-- =============================================
-- LEDGER ENTRIES
-- The debit/credit lines. Amounts are always positive; `direction`
-- carries the sign. Entries for a transaction must net to zero and
-- share the transaction's currency — enforced below, not just in
-- application code.
-- =============================================
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES ledger_transactions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0), -- smallest currency unit (kobo)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ledger_entries_transaction_idx ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS ledger_entries_account_idx ON ledger_entries(account_id);

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own ledger entries"
  ON ledger_entries FOR SELECT USING (
    account_id IN (
      SELECT la.id FROM ledger_accounts la
      JOIN wallets w ON w.id = la.wallet_id
      WHERE w.user_id = auth.uid()
    )
  );

CREATE TRIGGER ledger_entries_no_mutation
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

-- Deferred so all entries for one transaction can be inserted together and
-- checked once, at commit, rather than after each individual row insert.
CREATE OR REPLACE FUNCTION check_ledger_transaction_balances()
RETURNS TRIGGER AS $$
DECLARE
  net BIGINT;
  mismatched_currency INT;
BEGIN
  SELECT COUNT(*) INTO mismatched_currency
    FROM ledger_entries le
    JOIN ledger_accounts la ON la.id = le.account_id
    JOIN ledger_transactions lt ON lt.id = le.transaction_id
    WHERE le.transaction_id = NEW.transaction_id
      AND la.currency != lt.currency;

  IF mismatched_currency > 0 THEN
    RAISE EXCEPTION 'ledger_entries for transaction % reference an account in a different currency', NEW.transaction_id;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_minor ELSE -amount_minor END), 0)
    INTO net
    FROM ledger_entries
    WHERE transaction_id = NEW.transaction_id;

  IF net != 0 THEN
    RAISE EXCEPTION 'ledger_entries for transaction % do not net to zero (off by %)', NEW.transaction_id, net;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_entries_balance_check
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_ledger_transaction_balances();

-- =============================================
-- WALLET BALANCES (derived view)
-- The only place a "balance" number exists. Never a stored column.
-- RLS on the underlying tables applies automatically since this is
-- a plain (non-SECURITY DEFINER) view.
-- =============================================
CREATE OR REPLACE VIEW wallet_balances AS
SELECT
  w.id AS wallet_id,
  w.user_id,
  w.currency,
  la.id AS ledger_account_id,
  COALESCE(SUM(CASE WHEN le.direction = 'credit' THEN le.amount_minor ELSE -le.amount_minor END), 0) AS balance_minor
FROM wallets w
JOIN ledger_accounts la ON la.wallet_id = w.id
LEFT JOIN ledger_entries le ON le.account_id = la.id
GROUP BY w.id, w.user_id, w.currency, la.id;

-- =============================================
-- WEBHOOK EVENTS
-- Raw storage of every webhook payload, keyed by the provider's
-- event id. The UNIQUE constraint is what makes idempotent webhook
-- handling structurally guaranteed rather than "handled in
-- application code, hopefully."
-- =============================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL CHECK (provider IN ('paystack', 'stripe', 'flutterwave', 'anchor', 'mono')),
  provider_event_id TEXT NOT NULL,
  event_type TEXT,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS webhook_events_unprocessed_idx
  ON webhook_events(created_at) WHERE processed_at IS NULL;

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies for the `authenticated` role: this table is service-role only.

-- =============================================
-- AUTO-CREATE WALLET ON SIGNUP
-- Mirrors the existing handle_new_user() profile trigger.
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user_wallet()
RETURNS TRIGGER AS $$
DECLARE
  new_wallet_id UUID;
BEGIN
  INSERT INTO wallets (user_id, currency)
  VALUES (NEW.id, 'NGN')
  RETURNING id INTO new_wallet_id;

  INSERT INTO ledger_accounts (wallet_id, type, currency)
  VALUES (new_wallet_id, 'user_wallet', 'NGN');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_wallet();

-- Backfill wallets + ledger accounts for users who already exist.
INSERT INTO wallets (user_id, currency)
SELECT id, 'NGN' FROM auth.users
ON CONFLICT (user_id, currency) DO NOTHING;

INSERT INTO ledger_accounts (wallet_id, type, currency)
SELECT w.id, 'user_wallet', w.currency
FROM wallets w
WHERE NOT EXISTS (
  SELECT 1 FROM ledger_accounts la WHERE la.wallet_id = w.id
);
