-- ============================================================
-- Orbit Wallet — invoice payment posting with a platform fee split.
-- Depends on 006_ledger_rpc.sql (post_ledger_transaction).
--
-- Replaces the simple post_invoice_payment for the Paystack-backed
-- custody rail: instead of one 2-line transaction (clearing -> wallet),
-- this posts two linked transactions so the fee is its own auditable
-- line, not silently subtracted before ever reaching the ledger:
--   1. type=invoice_payment  clearing -> user_wallet   (net amount)
--   2. type=platform_fee     clearing -> platform_fee_revenue (fee)
-- Both keyed on the same reference (the payment id) but different
-- types, so each is independently idempotent under
-- post_ledger_transaction's (type, reference) uniqueness.
-- ============================================================

CREATE OR REPLACE FUNCTION post_invoice_payment_with_fee(
  p_payment_id UUID,
  p_user_id UUID,
  p_net_amount_minor BIGINT,
  p_fee_amount_minor BIGINT,
  p_currency TEXT DEFAULT 'NGN',
  p_provider TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_wallet_account_id UUID;
  v_clearing_account_id UUID;
  v_fee_account_id UUID;
  v_invoice_transaction_id UUID;
BEGIN
  IF p_net_amount_minor <= 0 THEN
    RAISE EXCEPTION 'net_amount_minor must be positive, got %', p_net_amount_minor;
  END IF;

  -- Get-or-create the user's wallet + ledger account for this currency.
  SELECT la.id INTO v_wallet_account_id
    FROM ledger_accounts la
    JOIN wallets w ON w.id = la.wallet_id
    WHERE w.user_id = p_user_id AND w.currency = p_currency AND la.type = 'user_wallet';

  IF v_wallet_account_id IS NULL THEN
    INSERT INTO wallets (user_id, currency)
    VALUES (p_user_id, p_currency)
    ON CONFLICT (user_id, currency) DO UPDATE SET currency = EXCLUDED.currency
    RETURNING id INTO v_wallet_id;

    INSERT INTO ledger_accounts (wallet_id, type, currency)
    VALUES (v_wallet_id, 'user_wallet', p_currency)
    ON CONFLICT (wallet_id) WHERE wallet_id IS NOT NULL DO NOTHING;

    SELECT id INTO v_wallet_account_id FROM ledger_accounts WHERE wallet_id = v_wallet_id;
  END IF;

  SELECT id INTO v_clearing_account_id
    FROM ledger_accounts
    WHERE type = 'payment_processor_clearing' AND currency = p_currency AND wallet_id IS NULL;
  IF v_clearing_account_id IS NULL THEN
    INSERT INTO ledger_accounts (wallet_id, type, currency) VALUES (NULL, 'payment_processor_clearing', p_currency)
      ON CONFLICT (type, currency) WHERE wallet_id IS NULL DO NOTHING;
    SELECT id INTO v_clearing_account_id
      FROM ledger_accounts WHERE type = 'payment_processor_clearing' AND currency = p_currency AND wallet_id IS NULL;
  END IF;

  v_invoice_transaction_id := post_ledger_transaction(
    p_type => 'invoice_payment',
    p_currency => p_currency,
    p_reference => p_payment_id::text,
    p_debit_account_id => v_clearing_account_id,
    p_credit_account_id => v_wallet_account_id,
    p_amount_minor => p_net_amount_minor,
    p_metadata => jsonb_build_object('payment_id', p_payment_id, 'provider', p_provider)
  );

  -- The fee line is optional - a zero fee is valid (e.g. promotional period).
  IF p_fee_amount_minor > 0 THEN
    SELECT id INTO v_fee_account_id
      FROM ledger_accounts
      WHERE type = 'platform_fee_revenue' AND currency = p_currency AND wallet_id IS NULL;
    IF v_fee_account_id IS NULL THEN
      INSERT INTO ledger_accounts (wallet_id, type, currency) VALUES (NULL, 'platform_fee_revenue', p_currency)
        ON CONFLICT (type, currency) WHERE wallet_id IS NULL DO NOTHING;
      SELECT id INTO v_fee_account_id
        FROM ledger_accounts WHERE type = 'platform_fee_revenue' AND currency = p_currency AND wallet_id IS NULL;
    END IF;

    PERFORM post_ledger_transaction(
      p_type => 'platform_fee',
      p_currency => p_currency,
      p_reference => p_payment_id::text,
      p_debit_account_id => v_clearing_account_id,
      p_credit_account_id => v_fee_account_id,
      p_amount_minor => p_fee_amount_minor,
      p_metadata => jsonb_build_object('payment_id', p_payment_id, 'provider', p_provider)
    );
  END IF;

  RETURN v_invoice_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION post_invoice_payment_with_fee(UUID, UUID, BIGINT, BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION post_invoice_payment_with_fee(UUID, UUID, BIGINT, BIGINT, TEXT, TEXT) TO service_role;
