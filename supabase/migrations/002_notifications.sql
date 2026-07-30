-- ============================================================
-- Orbit — Notifications Migration
-- Run this ONCE in Supabase SQL Editor to enable the bell dropdown.
-- ============================================================
--
-- After running, you should see:
--   - A "notifications" table in Database -> Tables
--   - The bell icon in the top bar will start showing new bookings,
--     payments, reminders, etc. as they happen.
-- ============================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'booking_received','booking_confirmed','booking_cancelled',
                'payment_received','invoice_overdue','reminder_due',
                'trial_ending','trial_expired',
                'subscription_renewed','subscription_failed',
                'client_birthday','welcome'
              )),
  title       TEXT NOT NULL,
  body        TEXT,
  action_url  TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for the queries useNotifications uses
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read) WHERE is_read = FALSE;

-- 3. Row Level Security
-- Users see/manage their own notifications. The service-role key (used by
-- webhooks and the respond endpoint) bypasses RLS, so it can still insert
-- notifications on the user's behalf.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own notifications" ON notifications;
CREATE POLICY "Users can read their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Inserts happen from server-side route handlers using the service-role key.
-- The service-role key bypasses RLS, so no INSERT policy is needed for it.
-- If you ever want client-side inserts (rare), add a policy here.

-- ============================================================
-- Verification - paste this AFTER running the migration to confirm.
-- It should return one row showing the new table.
-- ============================================================
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'notifications';
