-- ─────────────────────────────────────────────────────────────────────────
-- Migration 004: email-system audit columns
-- Adds columns used by the new email features so the app can dedupe sends
-- (welcome) and audit who's been chased / emailed (invoice + reminders).
--
-- All columns nullable + safe to apply on a live DB - the email handlers
-- gracefully ignore them if missing, but adding them unlocks dedupe.
-- ─────────────────────────────────────────────────────────────────────────

-- profiles: stamp the welcome email so we only send it once per account
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;

-- payments: when did we email the invoice + when did we last chase?
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS last_email_sent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at   timestamptz;

-- Optional: a small index to speed the nightly reminder cron's sweep.
-- NOTE: the payments table's due-date column is called `date`, not `due_date`
-- (mirrors mobile app's schema). The index uses that name.
CREATE INDEX IF NOT EXISTS payments_date_status_idx
  ON public.payments (date, status)
  WHERE status IN ('pending', 'overdue', 'partial');
