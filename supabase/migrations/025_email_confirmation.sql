-- Email confirmation at signup. New accounts start unconfirmed and get no
-- welcome/lifecycle emails until the owner clicks the link we send them.
-- Everyone who signed up before this is treated as confirmed.
-- Safe to run more than once.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN NOT NULL DEFAULT true;
-- Existing accounts got true above; from now on a new profile starts
-- unconfirmed however it was created (including signups that call Supabase
-- directly instead of Orbit's signup page).
ALTER TABLE profiles ALTER COLUMN email_confirmed SET DEFAULT false;

-- Only Orbit's server may change it (extends the billing-column guard from 024).
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
    NEW.email_confirmed := (SELECT email_confirmed_at IS NOT NULL FROM auth.users WHERE id = auth.uid());
    RETURN NEW;
  END IF;
  NEW.id                    := OLD.id;
  NEW.email                 := OLD.email;
  NEW.email_confirmed       := OLD.email_confirmed;
  NEW.subscription_status   := OLD.subscription_status;
  NEW.trial_ends_at         := OLD.trial_ends_at;
  NEW.created_at            := OLD.created_at;
  NEW.welcome_email_sent_at := OLD.welcome_email_sent_at;
  NEW.payment_provider      := OLD.payment_provider;
  NEW.provider_connected    := OLD.provider_connected;
  NEW.provider_account_id   := OLD.provider_account_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_billing ON profiles;
CREATE TRIGGER profiles_protect_billing
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_billing_columns();
