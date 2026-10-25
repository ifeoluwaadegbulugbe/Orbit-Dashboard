-- Email the Orbit inbox when someone uses the website's contact form.
-- The website saves each message to `leads` (source 'contact-form'); until
-- now nobody was told. A trigger pings Orbit straight away, and a job every
-- 15 minutes catches anything the ping missed. Safe to run more than once.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
-- Nothing older than this migration is announced except contact-form messages
-- (so messages already waiting still reach the inbox once).
UPDATE leads SET notified_at = now() WHERE notified_at IS NULL AND source IS DISTINCT FROM 'contact-form';
CREATE INDEX IF NOT EXISTS leads_contact_unnotified_idx
  ON leads (created_at) WHERE source = 'contact-form' AND notified_at IS NULL;

CREATE OR REPLACE FUNCTION notify_contact_form_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://app.getorbitcrm.com/api/cron/contact-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'appointment_reminders_cron_secret'
      )
    ),
    body := '{}'::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block saving the message; the 15-minute job will send it
END;
$$;

DROP TRIGGER IF EXISTS leads_contact_alert ON leads;
CREATE TRIGGER leads_contact_alert
  AFTER INSERT ON leads
  FOR EACH ROW WHEN (NEW.source = 'contact-form')
  EXECUTE FUNCTION notify_contact_form_lead();

SELECT cron.unschedule('contact-alerts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'contact-alerts');
SELECT cron.schedule(
  'contact-alerts',
  '*/15 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://app.getorbitcrm.com/api/cron/contact-alerts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'appointment_reminders_cron_secret'
      )
    )
  );
  $$
);
