-- Clients found on Instagram or TikTok often have no phone number on file.
-- Store their usernames (no @, lowercase) so Orbit can open a chat with them.
-- Phone stays NOT NULL but may be '' (already the case for online bookings
-- made without a phone). Safe to run more than once.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tiktok TEXT;

-- Only real usernames, since they end up inside links.
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_instagram_format;
ALTER TABLE clients ADD CONSTRAINT clients_instagram_format CHECK (instagram ~ '^[a-z0-9._]{1,30}$');
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_tiktok_format;
ALTER TABLE clients ADD CONSTRAINT clients_tiktok_format CHECK (tiktok ~ '^[a-z0-9._]{1,24}$');
