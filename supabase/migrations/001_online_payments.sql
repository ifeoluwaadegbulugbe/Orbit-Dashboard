-- ============================================================
-- TinyCRM — Online Payments Migration
-- Run this in your Supabase SQL editor to add payment fields
-- ============================================================

-- 1. Expand the payments table with online payment fields
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS invoice_number        TEXT,
  ADD COLUMN IF NOT EXISTS line_items            JSONB,
  ADD COLUMN IF NOT EXISTS paid_amount           NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS remaining_balance     NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_link          TEXT,
  ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider      TEXT CHECK (payment_provider IN ('paystack','stripe','flutterwave')),
  ADD COLUMN IF NOT EXISTS webhook_verified      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_completed_at  TIMESTAMPTZ;

-- Expand status to allow new values
-- NOTE: If your status column uses an enum, drop and recreate it:
-- ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'partial';
-- ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'failed';
-- ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded';
-- Otherwise, if it's TEXT with a CHECK constraint, update it:
-- ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
-- ALTER TABLE payments ADD CONSTRAINT payments_status_check
--   CHECK (status IN ('paid','pending','overdue','partial','failed','refunded'));

-- 2. Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments (user_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_provider
  ON payments (payment_provider) WHERE payment_provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_reference
  ON payments (transaction_reference) WHERE transaction_reference IS NOT NULL;

-- 3. Expand profiles table for payment provider settings
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_provider      TEXT CHECK (payment_provider IN ('paystack','stripe','flutterwave')),
  ADD COLUMN IF NOT EXISTS provider_connected    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS provider_account_id   TEXT;

-- ============================================================
-- Supabase Edge Functions to deploy:
-- ============================================================
-- supabase/functions/initialize-payment/index.ts
--   POST body: { paymentId, clientName, amount, currency, description, provider }
--   Returns:   { checkoutUrl, reference }
--   Env vars:  PAYSTACK_SECRET_KEY, STRIPE_SECRET_KEY, FLUTTERWAVE_SECRET_KEY
--
-- supabase/functions/payment-webhook/index.ts
--   Receives webhooks from Paystack / Stripe / Flutterwave
--   Verifies signature, marks payment as paid in DB
--   Env vars:  same as above + STRIPE_WEBHOOK_SECRET, FLUTTERWAVE_SECRET_HASH
-- ============================================================
