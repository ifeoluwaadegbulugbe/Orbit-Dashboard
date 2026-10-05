-- ============================================================
-- Orbit — public booking profile, reviews, client page, review requests
-- (numbered 017 to follow the mobile repo's migrations 013-016 on the same database)
--
-- reviews: one per booking, left by the client from a private signed link
-- (/review/<booking_id>?t=...). Written and read only by the server with
-- the service role (RLS on, owners can read and hide their own).
--
-- business-photos: public Storage bucket for the gallery on /book/<slug>.
-- Each owner can only write inside a folder named after their user id.
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- the business owner
  booking_id  UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  client_id   UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT CHECK (char_length(comment) <= 1000),
  service     TEXT,
  is_hidden   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON reviews(user_id, created_at DESC);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their reviews" ON reviews;
CREATE POLICY "Owners read their reviews" ON reviews
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners hide their reviews" ON reviews;
CREATE POLICY "Owners hide their reviews" ON reviews
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Work photos bucket ──────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('business-photos', 'business-photos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read business photos" ON storage.objects;
CREATE POLICY "Public read business photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'business-photos');

DROP POLICY IF EXISTS "Owners upload own photos" ON storage.objects;
CREATE POLICY "Owners upload own photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owners delete own photos" ON storage.objects;
CREATE POLICY "Owners delete own photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'business-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── New notification type for reviews ───────────────────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'booking_received','booking_confirmed','booking_cancelled',
  'payment_received','invoice_overdue','reminder_due',
  'trial_ending','trial_expired',
  'subscription_renewed','subscription_failed',
  'client_birthday','welcome',
  'review_received'
));

-- ── Automatic review requests ───────────────────────────────────────────
-- Set once a review request has gone out, so the cron never asks twice.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ;

-- New Automations switches (message_rules lives in the mobile repo's
-- migration 014; widen its allowed trigger types if the table exists).
DO $$
BEGIN
  IF to_regclass('public.message_rules') IS NOT NULL THEN
    ALTER TABLE message_rules DROP CONSTRAINT IF EXISTS message_rules_trigger_type_check;
    ALTER TABLE message_rules ADD CONSTRAINT message_rules_trigger_type_check CHECK (trigger_type IN (
      'booking_confirmation', 'birthday', 'payment_reminder', 'client_followup',
      'review_request', 'appointment_reminder'
    ));
  END IF;
END $$;
