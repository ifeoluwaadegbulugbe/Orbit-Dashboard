-- ============================================================
-- Orbit — link invoices to the booking that generated them
-- Nullable so existing invoices (created manually, with no booking) are
-- unaffected. Used both to trace an invoice back to its appointment and
-- to dedupe: never auto-create a second invoice for the same booking.
-- ============================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payments_booking_id_idx ON payments(booking_id) WHERE booking_id IS NOT NULL;
