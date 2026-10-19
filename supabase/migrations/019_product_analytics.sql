-- Product analytics: extend the existing event log (user_product_events,
-- from 018) so it can hold every tracked event exactly once, then backfill
-- the history that already exists in Orbit's own tables so the admin
-- dashboard has real data from day one. Safe to run more than once.

-- Who did it: the business owner, their customer (public booking page), or
-- Orbit itself (crons, webhooks). Only owner actions count as "active".
ALTER TABLE user_product_events ADD COLUMN IF NOT EXISTS actor TEXT NOT NULL DEFAULT 'owner';

-- One row per real-world action, keyed "<event>:<record id>:<owner id>". Retries, double clicks, React re-renders
-- and webhook redeliveries all carry the same key and are dropped.
-- (A UNIQUE constraint treats NULLs as distinct, so keyless events still insert.)
ALTER TABLE user_product_events ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
DO $$ BEGIN
  ALTER TABLE user_product_events ADD CONSTRAINT user_product_events_dedupe_key_key UNIQUE (dedupe_key);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS user_product_events_created_idx ON user_product_events (created_at DESC);

-- ── Backfill from existing records (marked backfilled, keyed so the live
-- tracking of the same records can never double-count them) ──────────────
INSERT INTO user_product_events (user_id, event, props, created_at, actor, dedupe_key)
SELECT user_id, 'client_created', '{"backfilled": true}', created_at, 'owner', 'client_created:' || id || ':' || user_id
FROM clients WHERE user_id IS NOT NULL
ON CONFLICT (dedupe_key) DO NOTHING;

INSERT INTO user_product_events (user_id, event, props, created_at, actor, dedupe_key)
SELECT user_id, 'booking_created', '{"backfilled": true}', created_at,
  -- requests from the public booking page are the customer's action, not the owner's
  CASE WHEN notes LIKE '%Submitted via booking link%' THEN 'customer' ELSE 'owner' END,
  'booking_created:' || id || ':' || user_id
FROM bookings WHERE user_id IS NOT NULL
ON CONFLICT (dedupe_key) DO NOTHING;

INSERT INTO user_product_events (user_id, event, props, created_at, actor, dedupe_key)
SELECT user_id, 'invoice_created', '{"backfilled": true}', created_at, 'owner', 'invoice_created:' || id || ':' || user_id
FROM payments WHERE user_id IS NOT NULL
ON CONFLICT (dedupe_key) DO NOTHING;

INSERT INTO user_product_events (user_id, event, props, created_at, actor, dedupe_key)
SELECT user_id, 'reminder_created', '{"backfilled": true}', created_at, 'owner', 'reminder_created:' || id || ':' || user_id
FROM reminders WHERE user_id IS NOT NULL
ON CONFLICT (dedupe_key) DO NOTHING;

INSERT INTO user_product_events (user_id, event, props, created_at, actor, dedupe_key)
SELECT user_id, 'payment_received', '{"backfilled": true}', payment_completed_at, 'system', 'payment_received:' || id || ':' || user_id
FROM payments WHERE user_id IS NOT NULL AND webhook_verified AND payment_completed_at IS NOT NULL
ON CONFLICT (dedupe_key) DO NOTHING;

-- Onboarding (best available signal for the past): the wizard saves
-- services and adds a first client, so accounts with either got through it.
-- (business_type can't be used - signup always sets it.)
INSERT INTO user_product_events (user_id, event, props, created_at, actor, dedupe_key)
SELECT p.id, 'onboarding_completed', '{"backfilled": true}', p.created_at, 'owner', 'onboarding_completed:' || p.id || ':' || p.id
FROM profiles p
WHERE jsonb_array_length(COALESCE(p.booking_link->'services', '[]'::jsonb)) > 0
   OR EXISTS (SELECT 1 FROM clients c WHERE c.user_id = p.id)
ON CONFLICT (dedupe_key) DO NOTHING;

-- Services and booking links have no creation date of their own. They're
-- dated at signup (most are set up in the welcome wizard), never at
-- profiles.updated_at: that moves on every app open and would fake activity.
INSERT INTO user_product_events (user_id, event, props, created_at, actor, dedupe_key)
SELECT id, 'service_created', '{"backfilled": true}', created_at, 'owner', 'service_created:backfill:' || id
FROM profiles WHERE jsonb_array_length(COALESCE(booking_link->'services', '[]'::jsonb)) > 0
ON CONFLICT (dedupe_key) DO NOTHING;

INSERT INTO user_product_events (user_id, event, props, created_at, actor, dedupe_key)
SELECT id, 'booking_link_created', '{"backfilled": true}', created_at, 'owner', 'booking_link_created:' || id || ':' || id
FROM profiles WHERE booking_link->>'slug' IS NOT NULL
ON CONFLICT (dedupe_key) DO NOTHING;
