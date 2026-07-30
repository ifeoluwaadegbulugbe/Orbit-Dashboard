-- ============================================================
-- Orbit Wallet — Ledger posting RPCs
-- Depends on 005_wallet_ledger.sql.
--
-- These are the ONLY sanctioned way to write to the ledger. They are
-- SECURITY DEFINER (run with the privileges of the function owner, not
-- the caller) specifically so the service role can post entries while
-- regular users still can't write to ledger_* tables directly per the
-- RLS policies in 005. EXECUTE is revoked from anon/authenticated below
-- for exactly that reason — do not skip that part when applying this.
-- ============================================================

-- =============================================
-- post_ledger_transaction
-- Generic, idempotent two-line posting. Locks both accounts (in a
-- stable order, to avoid deadlocking against a concurrent call that
-- touches the same two accounts in reverse order) before inserting,
-- so two concurrent postings against the same wallet serialize rather
-- than race. Idempotent on (type, reference): a retry with the same
-- type+reference returns the original transaction id instead of
-- posting twice.
-- =============================================
CREATE UNIQUE INDEX IF NOT EXISTS ledger_transactions_type_reference_unique
  ON ledger_transactions(type, reference) WHERE reference IS NOT NULL;

CREATE OR REPLACE FUNCTION post_ledger_transaction(
  p_type TEXT,
  p_currency TEXT,
  p_reference TEXT,
  p_debit_account_id UUID,
  p_credit_account_id UUID,
  p_amount_minor BIGINT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  IF p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'amount_minor must be positive, got %', p_amount_minor;
  END IF;
  IF p_debit_account_id = p_credit_account_id THEN
    RAISE EXCEPTION 'debit and credit account must differ';
  END IF;

  PERFORM 1 FROM ledger_accounts
    WHERE id IN (p_debit_account_id, p_credit_account_id)
    ORDER BY id
    FOR UPDATE;

  INSERT INTO ledger_transactions (type, status, currency, reference, metadata, created_by)
  VALUES (p_type, 'posted', p_currency, p_reference, p_metadata, p_created_by)
  ON CONFLICT (type, reference) WHERE reference IS NOT NULL DO NOTHING
  RETURNING id INTO v_transaction_id;

  IF v_transaction_id IS NULL THEN
    -- Already posted by a previous call with the same (type, reference) -
    -- a webhook retry, most likely. Return the original id, don't repost.
    SELECT id INTO v_transaction_id
      FROM ledger_transactions
      WHERE type = p_type AND reference = p_reference;
    RETURN v_transaction_id;
  END IF;

  INSERT INTO ledger_entries (transaction_id, account_id, direction, amount_minor)
  VALUES
    (v_transaction_id, p_debit_account_id, 'debit', p_amount_minor),
    (v_transaction_id, p_credit_account_id, 'credit', p_amount_minor);

  RETURN v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION post_ledger_transaction(TEXT, TEXT, TEXT, UUID, UUID, BIGINT, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION post_ledger_transaction(TEXT, TEXT, TEXT, UUID, UUID, BIGINT, JSONB, UUID) TO service_role;

-- =============================================
-- post_invoice_payment
-- Convenience wrapper for the one case the app needs today: a customer
-- paid an invoice via the business owner's own connected provider
-- (Stripe/Flutterwave/Paystack). Orbit never holds this money — the
-- debit side ("payment_processor_clearing") is a bookkeeping
-- counterparty representing "confirmed received externally", not a
-- real Orbit-held balance. This is what makes the model non-custodial:
-- the ledger is a statement of fact, not custody.
--
-- Gets-or-creates the wallet + ledger accounts for whatever currency
-- the payment is in, since a user may receive payments in more than
-- one currency across providers (e.g. NGN via Flutterwave, USD via
-- Stripe) and only ever gets an NGN wallet auto-created at signup.
-- =============================================
CREATE OR REPLACE FUNCTION post_invoice_payment(
  p_payment_id UUID,
  p_user_id UUID,
  p_amount_minor BIGINT,
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
  v_external_account_id UUID;
BEGIN
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

  SELECT id INTO v_external_account_id
    FROM ledger_accounts
    WHERE type = 'payment_processor_clearing' AND currency = p_currency AND wallet_id IS NULL;

  IF v_external_account_id IS NULL THEN
    INSERT INTO ledger_accounts (wallet_id, type, currency)
    VALUES (NULL, 'payment_processor_clearing', p_currency)
    ON CONFLICT (type, currency) WHERE wallet_id IS NULL DO NOTHING;

    SELECT id INTO v_external_account_id
      FROM ledger_accounts
      WHERE type = 'payment_processor_clearing' AND currency = p_currency AND wallet_id IS NULL;
  END IF;

  RETURN post_ledger_transaction(
    p_type => 'invoice_payment',
    p_currency => p_currency,
    p_reference => p_payment_id::text,
    p_debit_account_id => v_external_account_id,
    p_credit_account_id => v_wallet_account_id,
    p_amount_minor => p_amount_minor,
    p_metadata => jsonb_build_object('payment_id', p_payment_id, 'provider', p_provider)
  );
END;
$$;

REVOKE ALL ON FUNCTION post_invoice_payment(UUID, UUID, BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION post_invoice_payment(UUID, UUID, BIGINT, TEXT, TEXT) TO service_role;
