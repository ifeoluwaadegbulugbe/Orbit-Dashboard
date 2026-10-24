-- Orbit Pay: know when a payment actually reached the business's bank.
-- Paystack pays out the next business day; a twice-daily job asks
-- Paystack which payouts went through and marks those payments
-- "Paid to your bank". Safe to run more than once.

ALTER TABLE orbit_pay_charges ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
ALTER TABLE orbit_pay_charges ADD COLUMN IF NOT EXISTS settlement_id BIGINT;
CREATE INDEX IF NOT EXISTS orbit_pay_charges_unsettled_idx
  ON orbit_pay_charges (subaccount_code) WHERE status = 'success' AND settled_at IS NULL;

-- 10:00 and 16:00 Lagos time (09:00 / 15:00 UTC), every day.
SELECT cron.unschedule('orbit-pay-settlements')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'orbit-pay-settlements');
SELECT cron.schedule(
  'orbit-pay-settlements',
  '0 9,15 * * *',
  $$
  SELECT net.http_get(
    url := 'https://app.getorbitcrm.com/api/cron/orbit-pay-settlements',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'appointment_reminders_cron_secret'
      )
    )
  );
  $$
);
