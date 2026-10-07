-- ============================================================
-- Orbit — lifecycle email system (Phase 1)
--
-- Behaviour-based onboarding/activation emails, sent by the
-- /api/cron/lifecycle job (triggered every 15 minutes by pg_cron below)
-- through Orbit's existing email sender. Everything here is written by the
-- server with the service role; owners can only read/update their own
-- email preferences.
-- ============================================================

-- ── Activity: last time the owner used the app ──────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- ── Product events that can't be derived from existing tables ───────────
-- (clients/bookings/invoices/services are counted from their own tables;
-- this holds things like checkout_started that leave no other trace)
CREATE TABLE IF NOT EXISTS user_product_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,
  props       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_product_events_user_event_idx ON user_product_events(user_id, event, created_at DESC);
ALTER TABLE user_product_events ENABLE ROW LEVEL SECURITY;

-- ── Every lifecycle email: queue + delivery log + attribution ───────────
-- idempotency_key is UNIQUE: the same campaign can never go to the same
-- user twice, even if two cron runs overlap or an event is processed twice.
CREATE TABLE IF NOT EXISTS lifecycle_emails (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign         TEXT NOT NULL,
  category         TEXT NOT NULL,
  idempotency_key  TEXT NOT NULL UNIQUE,
  to_email         TEXT NOT NULL,
  subject          TEXT,
  status           TEXT NOT NULL DEFAULT 'sending'
                   CHECK (status IN ('sending', 'sent', 'failed', 'skipped')),
  attempts         SMALLINT NOT NULL DEFAULT 0,
  last_error       TEXT,
  next_attempt_at  TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  clicked_at       TIMESTAMPTZ,
  -- set when the user later does the thing this email asked for
  converted_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lifecycle_emails_user_idx ON lifecycle_emails(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS lifecycle_emails_retry_idx ON lifecycle_emails(status, next_attempt_at) WHERE status = 'failed';
ALTER TABLE lifecycle_emails ENABLE ROW LEVEL SECURITY;

-- ── Email preferences (marketing/lifecycle only - never blocks account,
-- security or payment emails) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tips             BOOLEAN NOT NULL DEFAULT TRUE,   -- setup help, tips & recommendations
  product_updates  BOOLEAN NOT NULL DEFAULT TRUE,   -- new features
  promotions       BOOLEAN NOT NULL DEFAULT TRUE,   -- Pro offers, checkout reminders
  unsubscribed_at  TIMESTAMPTZ,                     -- one-click "unsubscribe from all"
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own email preferences" ON email_preferences;
CREATE POLICY "Users manage own email preferences" ON email_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Suppression list: addresses that must never get lifecycle email ─────
CREATE TABLE IF NOT EXISTS email_suppressions (
  email       TEXT PRIMARY KEY,            -- stored lower-case
  reason      TEXT NOT NULL CHECK (reason IN ('bounce', 'complaint', 'unsubscribe', 'manual')),
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;

-- ── Each owner's activation progress + next best action (recomputed by
-- the cron job; read by the admin views later) ──────────────────────────
CREATE TABLE IF NOT EXISTS user_lifecycle (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stage                 TEXT NOT NULL,
  activation_steps      JSONB NOT NULL DEFAULT '{}'::jsonb,
  activation_pct        SMALLINT NOT NULL DEFAULT 0,
  activation_started_at TIMESTAMPTZ,
  activated_at          TIMESTAMPTZ,
  first_value_at        TIMESTAMPTZ,
  next_best_action      TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE user_lifecycle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own lifecycle" ON user_lifecycle;
CREATE POLICY "Users read own lifecycle" ON user_lifecycle FOR SELECT USING (auth.uid() = user_id);

-- ── Run the lifecycle job every 15 minutes ──────────────────────────────
-- Reuses the cron secret already stored in Vault by the mobile repo's
-- migration 015 (same value as CRON_SECRET in Vercel). Change the URL if
-- your production domain changes. Safe to re-run.
SELECT cron.schedule(
  'lifecycle-emails',
  '*/15 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://app.getorbitcrm.com/api/cron/lifecycle',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'appointment_reminders_cron_secret'
      )
    )
  );
  $$
);
