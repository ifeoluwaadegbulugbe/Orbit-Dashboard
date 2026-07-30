-- ============================================================
-- Orbit Wallet — Custody-model tables (Phase 1 of the wallet
-- foundation, per the "Orbit Wallet: Payments Architecture
-- Blueprint"). Depends on 005_wallet_ledger.sql and
-- 006_ledger_rpc.sql.
--
-- IMPORTANT: these tables exist so the app can be built and
-- tested end-to-end, but nothing here moves real money yet.
-- Bank account verification and payout initiation go through
-- src/lib/baas/ (see the BaaS adapter), which throws a clear
-- "not configured" error until real Anchor/Mono credentials are
-- wired in. Until then, the existing Stripe/Flutterwave
-- connect-your-own-account flow remains the only way money
-- actually moves — do not remove it before this is live.
-- ============================================================

-- =============================================
-- KYC PROFILES
-- One per user. Tiers gate wallet limits and withdrawal
-- eligibility (Section 9). We never store raw BVN/NIN — only
-- the verification provider's reference id for the check that
-- was performed.
-- =============================================
CREATE TABLE IF NOT EXISTS kyc_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier INT NOT NULL DEFAULT 0 CHECK (tier IN (0, 1, 2)),
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'pending', 'verified', 'rejected')),
  verification_provider TEXT, -- e.g. 'anchor', 'mono', 'smile_id'
  verification_reference TEXT, -- the provider's reference for this check, not the raw BVN/NIN
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE kyc_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own KYC profile"
  ON kyc_profiles FOR SELECT USING (auth.uid() = user_id);
-- No INSERT/UPDATE policy for `authenticated` — KYC status can only be
-- written by the service role, via the submit-kyc flow that calls the
-- verification provider first.

CREATE TRIGGER update_kyc_profiles_updated_at
  BEFORE UPDATE ON kyc_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Every wallet user starts at Tier 0 - unverified, withdrawals disabled,
-- small wallet cap. Mirrors handle_new_user_wallet() from 005.
CREATE OR REPLACE FUNCTION handle_new_user_kyc()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO kyc_profiles (user_id, tier, status)
  VALUES (NEW.id, 0, 'unverified')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_kyc
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_kyc();

INSERT INTO kyc_profiles (user_id, tier, status)
SELECT id, 0, 'unverified' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- =============================================
-- BANK ACCOUNTS
-- Saved withdrawal destinations. account_name is always the
-- name RESOLVED by the BaaS partner's name-inquiry API, never
-- user-typed free text — that's what makes this safe to pay out
-- to (Section 11: catches typos and destination-swap fraud).
-- =============================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL, -- resolved via BaaS name-inquiry, not user input
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'failed')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, bank_code, account_number)
);

CREATE INDEX IF NOT EXISTS bank_accounts_user_id_idx ON bank_accounts(user_id);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own bank accounts"
  ON bank_accounts FOR SELECT USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE for `authenticated` - adding a bank account must
-- go through the server route that calls resolveBankAccount() first, so
-- account_name is always provider-verified, never client-supplied.

-- =============================================
-- PAYMENT LINKS
-- Separate entity from `payments` (the invoice row) so a link
-- can expire and be regenerated without mutating invoice
-- history, and so the same machinery can later back
-- wallet-to-wallet "request money" links (Section 5).
-- =============================================
CREATE TABLE IF NOT EXISTS payment_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE, -- signed, embeds invoice id + amount + expiry
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'active', 'viewed', 'paid', 'expired', 'cancelled')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  viewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_links_payment_id_idx ON payment_links(payment_id);

ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view links for their own invoices"
  ON payment_links FOR SELECT USING (
    payment_id IN (SELECT id FROM payments WHERE user_id = auth.uid())
  );
-- Public/customer-facing resolution happens through a server route that
-- validates the signed token itself, not through RLS-scoped table access -
-- the customer never has a Supabase session.

-- =============================================
-- WITHDRAWALS
-- requested -> validated -> processing -> (completed | failed) ->
-- (reversed, if failed after the ledger debit already happened).
-- See 008_withdrawal_rpc.sql for the hold-then-confirm posting logic.
-- =============================================
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'validated', 'processing', 'completed', 'failed', 'reversed')),
  provider_payout_reference TEXT,
  failure_reason TEXT,
  hold_transaction_id UUID REFERENCES ledger_transactions(id), -- the debit posted at request time
  settlement_transaction_id UUID REFERENCES ledger_transactions(id), -- posted once the payout is confirmed
  reversal_transaction_id UUID REFERENCES ledger_transactions(id), -- posted if the payout fails
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS withdrawals_user_id_idx ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON withdrawals(status) WHERE status IN ('requested', 'validated', 'processing');

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own withdrawals"
  ON withdrawals FOR SELECT USING (auth.uid() = user_id);
-- No write policy for `authenticated` - withdrawals are created/updated only
-- through the request-withdrawal / handle-payout-webhook server flows
-- (service role), which is what makes the hold-then-confirm pattern in
-- Section 7 safe: a client can never write its own withdrawal state.
