-- Security hardening (from the October 2026 review). Safe to run more than once.

-- ── 1. Users can't give themselves Pro ────────────────────────────────────
-- profiles' RLS lets a user update their own row, which included billing
-- and identity columns. From the browser, a user could set
-- subscription_status = 'pro', or copy the owner's email (which the Pro
-- check trusts). These columns are now only changeable by Orbit's server
-- (service role); from a user session the old values are silently kept.
CREATE OR REPLACE FUNCTION protect_profile_billing_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW; -- Orbit's server: allowed
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.subscription_status := 'free';
    NEW.trial_ends_at := NULL;
    NEW.email := (SELECT email FROM auth.users WHERE id = auth.uid());
    RETURN NEW;
  END IF;
  NEW.id                  := OLD.id;
  NEW.email               := OLD.email;
  NEW.subscription_status := OLD.subscription_status;
  NEW.trial_ends_at       := OLD.trial_ends_at;
  NEW.created_at          := OLD.created_at;
  NEW.welcome_email_sent_at := OLD.welcome_email_sent_at;
  NEW.payment_provider    := OLD.payment_provider;
  NEW.provider_connected  := OLD.provider_connected;
  NEW.provider_account_id := OLD.provider_account_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_billing ON profiles;
CREATE TRIGGER profiles_protect_billing
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_billing_columns();

-- ── 2. One business per booking link ──────────────────────────────────────
-- Two businesses with the same slug broke both public pages (and let one
-- business hijack another's link). Case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_booking_slug_unique
  ON profiles (lower(booking_link->>'slug'))
  WHERE booking_link->>'slug' IS NOT NULL AND booking_link->>'slug' <> '';

-- ── 3. Rate limits for public and email-sending endpoints ─────────────────
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id          BIGSERIAL PRIMARY KEY,
  bucket      TEXT NOT NULL,           -- e.g. "public-booking:ip:1.2.3.4"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limit_hits_bucket_idx ON rate_limit_hits (bucket, created_at DESC);
ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY; -- server only, no policies

-- Old hits are useless after a day; clear them nightly.
SELECT cron.unschedule('rate-limit-cleanup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rate-limit-cleanup');
SELECT cron.schedule('rate-limit-cleanup', '30 3 * * *',
  $$DELETE FROM rate_limit_hits WHERE created_at < now() - interval '2 days'$$);
