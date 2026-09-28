-- ============================================================
-- Orbit — rate limit for password-reset emails
-- One row per reset request. The /api/auth/forgot-password route (service
-- role only) counts recent rows per email and per IP before sending, so the
-- endpoint can't be used to flood someone's inbox or burn our email quota.
-- RLS is on with no policies, so anon/authenticated clients can't touch it.
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_requests_email_idx ON password_reset_requests(email, created_at DESC);
CREATE INDEX IF NOT EXISTS password_reset_requests_ip_idx    ON password_reset_requests(ip, created_at DESC);

ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;
