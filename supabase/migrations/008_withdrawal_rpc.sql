-- ============================================================
-- Orbit Wallet — Withdrawal RPCs (hold-then-confirm pattern,
-- Section 7 of the blueprint). Depends on 006_ledger_rpc.sql and
-- 007_wallet_custody_tables.sql.
--
-- request_withdrawal debits the wallet immediately, before any
-- external payout call is made — so the user's available balance
-- already reflects money that's committed to leaving, closing the
-- double-spend window. settle_withdrawal / fail_withdrawal are
-- called once the BaaS partner confirms or the payout call fails;
-- fail_withdrawal reverses the hold rather than leaving the user
-- short.
-- ============================================================

CREATE OR REPLACE FUNCTION request_withdrawal(
  p_user_id UUID,
  p_bank_account_id UUID,
  p_amount_minor BIGINT,
  p_currency TEXT DEFAULT 'NGN'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_wallet_account_id UUID;
  v_payout_clearing_id UUID;
  v_balance_minor BIGINT;
  v_withdrawal_id UUID;
  v_hold_transaction_id UUID;
BEGIN
  IF p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'amount_minor must be positive';
  END IF;

  SELECT w.id, la.id INTO v_wallet_id, v_wallet_account_id
    FROM wallets w
    JOIN ledger_accounts la ON la.wallet_id = w.id
    WHERE w.user_id = p_user_id AND w.currency = p_currency AND la.type = 'user_wallet';

  IF v_wallet_account_id IS NULL THEN
    RAISE EXCEPTION 'no % wallet found for user %', p_currency, p_user_id;
  END IF;

  -- Lock the wallet's ledger account row so a second concurrent withdrawal
  -- request against the same wallet blocks until this one commits or rolls
  -- back - this is what makes "two tabs clicking Withdraw" safe (Section 18).
  PERFORM 1 FROM ledger_accounts WHERE id = v_wallet_account_id FOR UPDATE;

  SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_minor ELSE -amount_minor END), 0)
    INTO v_balance_minor
    FROM ledger_entries
    WHERE account_id = v_wallet_account_id;

  IF v_balance_minor < p_amount_minor THEN
    RAISE EXCEPTION 'insufficient balance: have %, requested %', v_balance_minor, p_amount_minor;
  END IF;

  SELECT id INTO v_payout_clearing_id
    FROM ledger_accounts
    WHERE type = 'payout_clearing' AND currency = p_currency AND wallet_id IS NULL;

  IF v_payout_clearing_id IS NULL THEN
    INSERT INTO ledger_accounts (wallet_id, type, currency)
    VALUES (NULL, 'payout_clearing', p_currency)
    ON CONFLICT (type, currency) WHERE wallet_id IS NULL DO NOTHING;

    SELECT id INTO v_payout_clearing_id
      FROM ledger_accounts
      WHERE type = 'payout_clearing' AND currency = p_currency AND wallet_id IS NULL;
  END IF;

  INSERT INTO withdrawals (user_id, wallet_id, bank_account_id, amount_minor, currency, status)
  VALUES (p_user_id, v_wallet_id, p_bank_account_id, p_amount_minor, p_currency, 'requested')
  RETURNING id INTO v_withdrawal_id;

  v_hold_transaction_id := post_ledger_transaction(
    p_type => 'withdrawal_hold',
    p_currency => p_currency,
    p_reference => v_withdrawal_id::text,
    p_debit_account_id => v_wallet_account_id,
    p_credit_account_id => v_payout_clearing_id,
    p_amount_minor => p_amount_minor,
    p_metadata => jsonb_build_object('withdrawal_id', v_withdrawal_id, 'bank_account_id', p_bank_account_id)
  );

  UPDATE withdrawals
    SET status = 'validated', hold_transaction_id = v_hold_transaction_id
    WHERE id = v_withdrawal_id;

  RETURN v_withdrawal_id;
END;
$$;

REVOKE ALL ON FUNCTION request_withdrawal(UUID, UUID, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_withdrawal(UUID, UUID, BIGINT, TEXT) TO service_role;

-- =============================================
-- settle_withdrawal — called once the BaaS partner confirms the
-- payout landed. Moves the hold from payout_clearing to a
-- payout_settled account (for reconciliation) and closes out the
-- withdrawal row.
-- =============================================
CREATE OR REPLACE FUNCTION settle_withdrawal(
  p_withdrawal_id UUID,
  p_provider_payout_reference TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currency TEXT;
  v_amount BIGINT;
  v_payout_clearing_id UUID;
  v_payout_settled_id UUID;
  v_settlement_transaction_id UUID;
BEGIN
  SELECT currency, amount_minor INTO v_currency, v_amount
    FROM withdrawals WHERE id = p_withdrawal_id;
  IF v_currency IS NULL THEN
    RAISE EXCEPTION 'withdrawal % not found', p_withdrawal_id;
  END IF;

  SELECT id INTO v_payout_clearing_id
    FROM ledger_accounts WHERE type = 'payout_clearing' AND currency = v_currency AND wallet_id IS NULL;

  SELECT id INTO v_payout_settled_id
    FROM ledger_accounts WHERE type = 'payout_settled' AND currency = v_currency AND wallet_id IS NULL;
  IF v_payout_settled_id IS NULL THEN
    INSERT INTO ledger_accounts (wallet_id, type, currency) VALUES (NULL, 'payout_settled', v_currency)
      ON CONFLICT (type, currency) WHERE wallet_id IS NULL DO NOTHING;
    SELECT id INTO v_payout_settled_id
      FROM ledger_accounts WHERE type = 'payout_settled' AND currency = v_currency AND wallet_id IS NULL;
  END IF;

  v_settlement_transaction_id := post_ledger_transaction(
    p_type => 'withdrawal_settled',
    p_currency => v_currency,
    p_reference => p_withdrawal_id::text,
    p_debit_account_id => v_payout_clearing_id,
    p_credit_account_id => v_payout_settled_id,
    p_amount_minor => v_amount,
    p_metadata => jsonb_build_object('withdrawal_id', p_withdrawal_id)
  );

  UPDATE withdrawals
    SET status = 'completed',
        provider_payout_reference = COALESCE(p_provider_payout_reference, provider_payout_reference),
        settlement_transaction_id = v_settlement_transaction_id,
        completed_at = NOW()
    WHERE id = p_withdrawal_id;
END;
$$;

REVOKE ALL ON FUNCTION settle_withdrawal(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION settle_withdrawal(UUID, TEXT) TO service_role;

-- =============================================
-- fail_withdrawal — called if the payout call fails or the
-- partner reports failure. Reverses the hold: credits the money
-- back to the user's wallet rather than leaving it stuck in
-- payout_clearing.
-- =============================================
CREATE OR REPLACE FUNCTION fail_withdrawal(
  p_withdrawal_id UUID,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currency TEXT;
  v_amount BIGINT;
  v_wallet_id UUID;
  v_wallet_account_id UUID;
  v_payout_clearing_id UUID;
  v_reversal_transaction_id UUID;
BEGIN
  SELECT currency, amount_minor, wallet_id INTO v_currency, v_amount, v_wallet_id
    FROM withdrawals WHERE id = p_withdrawal_id;
  IF v_currency IS NULL THEN
    RAISE EXCEPTION 'withdrawal % not found', p_withdrawal_id;
  END IF;

  SELECT la.id INTO v_wallet_account_id
    FROM ledger_accounts la WHERE la.wallet_id = v_wallet_id AND la.type = 'user_wallet';

  SELECT id INTO v_payout_clearing_id
    FROM ledger_accounts WHERE type = 'payout_clearing' AND currency = v_currency AND wallet_id IS NULL;

  v_reversal_transaction_id := post_ledger_transaction(
    p_type => 'withdrawal_reversed',
    p_currency => v_currency,
    p_reference => p_withdrawal_id::text,
    p_debit_account_id => v_payout_clearing_id,
    p_credit_account_id => v_wallet_account_id,
    p_amount_minor => v_amount,
    p_metadata => jsonb_build_object('withdrawal_id', p_withdrawal_id, 'reason', p_failure_reason)
  );

  UPDATE withdrawals
    SET status = 'failed',
        failure_reason = p_failure_reason,
        reversal_transaction_id = v_reversal_transaction_id,
        completed_at = NOW()
    WHERE id = p_withdrawal_id;
END;
$$;

REVOKE ALL ON FUNCTION fail_withdrawal(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fail_withdrawal(UUID, TEXT) TO service_role;
