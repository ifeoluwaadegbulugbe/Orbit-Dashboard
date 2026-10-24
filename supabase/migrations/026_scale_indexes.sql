-- Indexes for the lookups Orbit does most, so they stay fast as the number
-- of businesses grows. Adding an index never changes data. Safe to re-run.

-- Clients: birthdays cron, email look-ups (public booking dedupe, send-email check)
CREATE INDEX IF NOT EXISTS clients_birthday_idx ON clients (birthday) WHERE birthday IS NOT NULL;
CREATE INDEX IF NOT EXISTS clients_user_email_idx ON clients (user_id, email);
CREATE INDEX IF NOT EXISTS clients_user_phone_idx ON clients (user_id, phone);

-- Bookings: owner's calendar, reminders and review requests by date/status
CREATE INDEX IF NOT EXISTS bookings_user_date_idx ON bookings (user_id, date);
CREATE INDEX IF NOT EXISTS bookings_status_date_idx ON bookings (status, date);

-- Payments: overdue reminders, per-owner lists
CREATE INDEX IF NOT EXISTS payments_user_date_idx ON payments (user_id, date DESC);
CREATE INDEX IF NOT EXISTS payments_status_date_idx ON payments (status, date);

-- Notifications: the bell (newest first, unread)
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC);

-- Automations settings per owner
CREATE INDEX IF NOT EXISTS message_rules_user_trigger_idx ON message_rules (user_id, trigger_type);

-- Profiles: every public booking page load looks the business up by slug
CREATE INDEX IF NOT EXISTS profiles_booking_slug_idx ON profiles ((booking_link->>'slug'));
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles (email);

-- Orbit Pay: charge look-ups by Paystack reference (webhooks, refunds)
CREATE INDEX IF NOT EXISTS orbit_pay_charges_reference_idx ON orbit_pay_charges (reference);
