-- ============================================================================
-- Subscription payment finalization hardening
-- - Supports first-time checkout before an organization_subscription row exists.
-- - Adds the payment acknowledgement status used by the frontend callback flow.
-- - Adds provider_environment to webhook events for provider/env idempotency.
-- - Finalizes payment, invoice, and subscription in one database transaction.
-- ============================================================================

ALTER TABLE public.org_subscription_invoices
  ALTER COLUMN subscription_id DROP NOT NULL;

ALTER TABLE public.org_subscription_payments
  ALTER COLUMN subscription_id DROP NOT NULL;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'org_subscription_payments'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.org_subscription_payments DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.org_subscription_payments
  ADD CONSTRAINT org_subscription_payments_status_check
  CHECK (status IN (
    'pending',
    'created',
    'processing',
    'signature_acknowledged',
    'paid',
    'failed',
    'refunded',
    'partially_refunded',
    'cancelled'
  ));

ALTER TABLE public.payment_provider_events
  ADD COLUMN IF NOT EXISTS provider_environment text CHECK (provider_environment IN ('test', 'live')) DEFAULT 'test';

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_env_event
  ON public.payment_provider_events (provider, provider_environment, event_id)
  WHERE event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.finalize_razorpay_subscription_payment(
  p_provider_order_id text,
  p_provider_payment_id text,
  p_provider_environment text,
  p_event_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_invoice record;
  v_subscription record;
  v_now timestamptz := now();
  v_days integer := 30;
  v_period_end timestamptz;
  v_subscription_id uuid;
  v_already_finalized boolean := false;
BEGIN
  IF coalesce(p_provider_order_id, '') = '' OR coalesce(p_provider_payment_id, '') = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT', 'error', 'Provider order and payment IDs are required.');
  END IF;

  SELECT *
  INTO v_payment
  FROM public.org_subscription_payments
  WHERE provider = 'razorpay'
    AND provider_order_id = p_provider_order_id
    AND coalesce(provider_environment, 'test') = coalesce(p_provider_environment, 'test')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_NOT_FOUND', 'error', 'No matching payment record found for this order.');
  END IF;

  IF v_payment.provider_payment_id IS NOT NULL AND v_payment.provider_payment_id <> p_provider_payment_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'PAYMENT_ID_MISMATCH', 'error', 'Payment ID does not match this order.');
  END IF;

  SELECT *
  INTO v_invoice
  FROM public.org_subscription_invoices
  WHERE id = v_payment.invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVOICE_NOT_FOUND', 'error', 'Invoice not found.');
  END IF;

  IF v_invoice.organization_id <> v_payment.organization_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'ORG_MISMATCH', 'error', 'Organization mismatch between invoice and payment.');
  END IF;

  IF v_invoice.razorpay_order_id IS NOT NULL AND v_invoice.razorpay_order_id <> p_provider_order_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'ORDER_MISMATCH', 'error', 'Razorpay order does not match invoice.');
  END IF;

  IF coalesce(v_invoice.currency, 'INR') <> coalesce(v_payment.currency, 'INR') THEN
    RETURN jsonb_build_object('success', false, 'code', 'CURRENCY_MISMATCH', 'error', 'Currency mismatch between invoice and payment.');
  END IF;

  IF abs(coalesce(v_invoice.total_amount, v_invoice.subtotal_amount, 0) - coalesce(v_payment.amount, 0)) > 1 THEN
    RETURN jsonb_build_object('success', false, 'code', 'AMOUNT_MISMATCH', 'error', 'Payment amount does not match invoice total.');
  END IF;

  IF v_invoice.status = 'paid' AND v_payment.status = 'paid' THEN
    v_already_finalized := true;
  END IF;

  IF v_invoice.subscription_id IS NOT NULL THEN
    SELECT *
    INTO v_subscription
    FROM public.organization_subscriptions
    WHERE id = v_invoice.subscription_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'code', 'SUBSCRIPTION_NOT_FOUND', 'error', 'Referenced subscription not found.');
    END IF;

    IF v_subscription.organization_id <> v_payment.organization_id THEN
      RETURN jsonb_build_object('success', false, 'code', 'SUBSCRIPTION_ORG_MISMATCH', 'error', 'Subscription organization mismatch.');
    END IF;

    v_subscription_id := v_subscription.id;
  END IF;

  IF v_invoice.billing_cycle = 'annual' THEN
    v_days := 365;
  ELSIF v_invoice.billing_cycle = 'quarterly' THEN
    v_days := 90;
  ELSIF v_invoice.billing_cycle = 'half_yearly' THEN
    v_days := 182;
  ELSE
    v_days := 30;
  END IF;

  v_period_end := v_now + make_interval(days => v_days);

  UPDATE public.org_subscription_payments
  SET status = 'paid',
      provider_payment_id = p_provider_payment_id,
      provider_signature_verified = true,
      paid_at = coalesce(paid_at, v_now),
      updated_at = v_now
  WHERE id = v_payment.id;

  UPDATE public.org_subscription_invoices
  SET status = 'paid',
      amount_paid = greatest(coalesce(amount_paid, 0), coalesce(total_amount, subtotal_amount, 0)),
      razorpay_payment_id = p_provider_payment_id,
      paid_at = coalesce(paid_at, v_now),
      updated_at = v_now
  WHERE id = v_invoice.id;

  IF v_subscription_id IS NULL THEN
    IF v_invoice.package_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'code', 'PACKAGE_NOT_FOUND', 'error', 'Invoice package is required to create a subscription.');
    END IF;

    INSERT INTO public.organization_subscriptions (
      organization_id,
      package_id,
      status,
      billing_period,
      started_at,
      expires_at,
      next_billing_date,
      latest_invoice_id,
      latest_payment_id,
      provider,
      provider_environment,
      auto_renew,
      created_at,
      updated_at
    )
    VALUES (
      v_payment.organization_id,
      v_invoice.package_id,
      'active',
      coalesce(v_invoice.billing_cycle, 'monthly'),
      v_now,
      v_period_end,
      v_period_end,
      v_invoice.id,
      v_payment.id,
      'razorpay',
      coalesce(p_provider_environment, 'test'),
      true,
      v_now,
      v_now
    )
    RETURNING id INTO v_subscription_id;

    UPDATE public.org_subscription_invoices
    SET subscription_id = v_subscription_id
    WHERE id = v_invoice.id;

    UPDATE public.org_subscription_payments
    SET subscription_id = v_subscription_id
    WHERE id = v_payment.id;
  ELSE
    UPDATE public.organization_subscriptions
    SET package_id = coalesce(v_invoice.package_id, package_id),
        status = 'active',
        billing_period = coalesce(v_invoice.billing_cycle, billing_period),
        trial_ends_at = CASE WHEN trial_ends_at IS NOT NULL THEN v_now ELSE trial_ends_at END,
        started_at = coalesce(started_at, v_now),
        expires_at = v_period_end,
        next_billing_date = v_period_end,
        latest_invoice_id = v_invoice.id,
        latest_payment_id = v_payment.id,
        provider = 'razorpay',
        provider_environment = coalesce(p_provider_environment, 'test'),
        updated_at = v_now
    WHERE id = v_subscription_id;
  END IF;

  INSERT INTO public.subscription_events (
    organization_id,
    subscription_id,
    event_type,
    new_state,
    reason,
    metadata,
    created_at
  )
  VALUES (
    v_payment.organization_id,
    v_subscription_id,
    CASE WHEN v_already_finalized THEN 'payment_duplicate_ignored' ELSE 'payment_finalized' END,
    jsonb_build_object(
      'providerOrderId', p_provider_order_id,
      'providerPaymentId', p_provider_payment_id,
      'invoiceId', v_invoice.id,
      'amount', v_payment.amount
    ),
    CASE WHEN v_already_finalized THEN 'Duplicate Razorpay payment event ignored.' ELSE 'Razorpay payment finalized.' END,
    jsonb_build_object('eventId', p_event_id, 'providerEnvironment', coalesce(p_provider_environment, 'test')),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoiceId', v_invoice.id,
    'paymentId', v_payment.id,
    'subscriptionId', v_subscription_id,
    'wasAlreadyFinalized', v_already_finalized
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_razorpay_subscription_payment(text, text, text, text) TO service_role;
