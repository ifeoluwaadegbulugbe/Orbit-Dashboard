-- Monday "your week" summary email: its own on/off switch in Settings.
-- Everyone starts with it on, except people who already unsubscribed from everything.
-- Safe to run more than once.

ALTER TABLE email_preferences ADD COLUMN IF NOT EXISTS weekly_summary BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE email_preferences SET weekly_summary = FALSE WHERE unsubscribed_at IS NOT NULL;
