-- Orbit Pay: payments settle straight from Paystack to each business's own
-- bank account (a Paystack subaccount). Orbit never holds client money.
--
-- This migration:
--   1. adds the per-business Orbit Pay settings (subaccount + fee setting)
--   2. adds a record of every Orbit Pay charge (a log of what Paystack
--      reports - never a balance)
--   3. switches OFF the old wallet: no new wallets, no wallet postings, no
--      withdrawals. The old tables are kept read-only for the record.
--   4. clears unpaid payment links that would still pay into Orbit's own
--      Paystack balance.
-- Safe to run more than once.

-- ── 1. Orbit Pay settings, one row per business ───────────────────────────
CREATE TABLE IF NOT EXISTS orbit_pay_accounts (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subaccount_code    TEXT NOT NULL,                 -- Paystack ACCT_xxx
  bank_code          TEXT NOT NULL,
  bank_name          TEXT NOT NULL,
  account_last4      TEXT NOT NULL,                 -- full number stays with Paystack
  account_name       TEXT NOT NULL,                 -- as resolved by Paystack and confirmed by the owner
  fee_bearer         TEXT NOT NULL DEFAULT 'merchant' CHECK (fee_bearer IN ('merchant', 'client')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE orbit_pay_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orbit_pay_accounts: owner reads own" ON orbit_pay_accounts;
CREATE POLICY "orbit_pay_accounts: owner reads own" ON orbit_pay_accounts
  FOR SELECT USING (auth.uid() = user_id);
-- Writes only through the server (it verifies the bank account with Paystack first).

-- ── 2. Every Orbit Pay charge (amounts in kobo, integers) ─────────────────
-- Created when the owner makes a payment link: the fee is fixed then, at
-- the owner's plan at that moment, for both local and international cards.
CREATE TABLE IF NOT EXISTS orbit_pay_charges (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id             UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  subaccount_code        TEXT NOT NULL,
  plan_at_charge         TEXT NOT NULL CHECK (plan_at_charge IN ('free', 'pro')),
  fee_bearer             TEXT NOT NULL CHECK (fee_bearer IN ('merchant', 'client')),
  service_kobo           BIGINT NOT NULL CHECK (service_kobo > 0),
  fee_kobo               BIGINT NOT NULL CHECK (fee_kobo >= 0),
  charge_kobo            BIGINT NOT NULL CHECK (charge_kobo > 0),
  intl_fee_kobo          BIGINT NOT NULL CHECK (intl_fee_kobo >= 0),
  intl_charge_kobo       BIGINT NOT NULL CHECK (intl_charge_kobo > 0),
  card_region            TEXT CHECK (card_region IN ('local', 'international')),
  reference              TEXT UNIQUE,               -- latest Paystack reference for this charge
  status                 TEXT NOT NULL DEFAULT 'quoted'
                         CHECK (status IN ('quoted', 'pending', 'success', 'failed', 'refunded', 'partially_refunded', 'disputed')),
  paid_kobo              BIGINT,                    -- what Paystack says the client paid
  paystack_fee_kobo      BIGINT,                    -- what Paystack charged (borne by Orbit)
  channel                TEXT,
  card_country           TEXT,
  refunded_kobo          BIGINT NOT NULL DEFAULT 0,
  paid_at                TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orbit_pay_charges_user_idx ON orbit_pay_charges (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orbit_pay_charges_payment_idx ON orbit_pay_charges (payment_id);
ALTER TABLE orbit_pay_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orbit_pay_charges: owner reads own" ON orbit_pay_charges;
CREATE POLICY "orbit_pay_charges: owner reads own" ON orbit_pay_charges
  FOR SELECT USING (auth.uid() = user_id);

-- ── 3. Switch off the old wallet ──────────────────────────────────────────
-- Orbit must not hold or move money. Kept: the tables and their history
-- (read-only). Removed: creating wallets, posting into them, withdrawals.
DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON auth.users;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION request_withdrawal(UUID, UUID, BIGINT, TEXT) FROM service_role, authenticated, anon, PUBLIC;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION post_invoice_payment_with_fee(UUID, UUID, BIGINT, BIGINT, TEXT, TEXT) FROM service_role, authenticated, anon, PUBLIC;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
UPDATE wallets SET status = 'closed' WHERE status <> 'closed';

-- ── 4. Old unpaid payment links paid into Orbit's own balance ────────────
-- Clear them so nobody pays one; owners make a new Orbit Pay link instead.
UPDATE payments
SET payment_link = NULL
WHERE status <> 'paid'
  AND payment_link LIKE 'https://checkout.paystack.com/%';
