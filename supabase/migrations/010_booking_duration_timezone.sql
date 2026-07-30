-- ============================================================
-- Orbit — real booking duration + owner timezone
-- Fixes two approximations from 009_google_calendar_sync.sql: every
-- synced event defaulted to 1 hour, and timezone was guessed from a
-- crude country -> IANA-zone map instead of the owner's real timezone.
-- ============================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_minutes INT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT;
