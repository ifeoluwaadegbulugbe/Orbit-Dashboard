-- Phone push notifications: one row per device/browser that said "yes".
-- The endpoint is the browser's own address for this device; it's unique,
-- so re-enabling on the same phone (or another account signing in on it)
-- updates the row instead of adding a duplicate. Rows are removed when the
-- browser reports the subscription gone (HTTP 404/410). Safe to re-run.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

-- Only the server (service role) reads or writes these; the browser goes
-- through /api/push/subscribe, which takes the user from the session.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
