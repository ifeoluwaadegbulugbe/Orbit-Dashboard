-- ============================================================
-- Orbit — Google Calendar one-way sync
-- Bookings created/confirmed/cancelled in Orbit are pushed to the
-- business owner's Google Calendar. Read-only mirror: Orbit never
-- reads the owner's calendar back (that's two-way sync, not built).
-- ============================================================

-- =============================================
-- GOOGLE CALENDAR CONNECTIONS
-- One per user. Tokens are as sensitive as a payment provider's
-- secret key - no RLS SELECT policy for `authenticated` at all,
-- so a client can never read its own tokens even by accident.
-- The UI only ever sees a derived connected/not-connected boolean
-- from a server route, never this table directly.
-- =============================================
CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  scope TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies for `authenticated` - RLS denies by default, so
-- only the service role (which bypasses RLS) can read or write this table.

CREATE TRIGGER update_google_calendar_connections_updated_at
  BEFORE UPDATE ON google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Track the synced event per booking so updates/cancellations hit the
-- right Google event instead of creating duplicates.
-- =============================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS google_event_id TEXT;
