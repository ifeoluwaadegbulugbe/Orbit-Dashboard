-- Free plan: up to 10 clients, enforced by the database itself (the app's
-- screens already stop at 10; this stops anyone getting round them).
--
-- Applies only when a signed-in business adds a client themselves. Never
-- applies to Orbit's own server (service role) - so a customer booking
-- through a business's public booking page is never turned away - and
-- never touches existing clients: nothing is locked or deleted.
--
-- Pro = the same rules as src/lib/subscription/isPro.ts:
--   subscription_status 'pro', or 'trial' with trial_ends_at in the future,
--   or an owner account listed in ADMIN_EMAILS.
-- Change FREE_CLIENT_LIMIT here and in src/lib/constants.ts together.

CREATE OR REPLACE FUNCTION enforce_free_client_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  free_limit CONSTANT INT := 10;
  owner_emails CONSTANT TEXT[] := ARRAY['ifeoluwaadegbulugbe@gmail.com'];
  p RECORD;
  existing INT;
BEGIN
  -- Orbit's server (public booking page, imports) is never limited.
  IF auth.uid() IS NULL OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT email, subscription_status, trial_ends_at INTO p FROM profiles WHERE id = NEW.user_id;
  IF p.subscription_status = 'pro'
     OR (p.subscription_status = 'trial' AND p.trial_ends_at > now())
     OR lower(coalesce(p.email, '')) = ANY(owner_emails) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO existing FROM clients WHERE user_id = NEW.user_id;
  IF existing >= free_limit THEN
    RAISE EXCEPTION 'FREE_CLIENT_LIMIT: The Free plan allows up to % clients.', free_limit
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_free_limit ON clients;
CREATE TRIGGER clients_free_limit
  BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION enforce_free_client_limit();
