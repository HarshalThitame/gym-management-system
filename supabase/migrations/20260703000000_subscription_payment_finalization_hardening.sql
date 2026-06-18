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

-- Subscription events are an audit stream. Keep event names extensible so new
-- payment lifecycle events do not require replacing a hard-coded enum check.
ALTER TABLE public.subscription_events
  DROP CONSTRAINT IF EXISTS subscription_events_event_type_check;

ALTER TABLE public.subscription_events
  ADD CONSTRAINT subscription_events_event_type_check
  CHECK (length(btrim(event_type)) > 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_env_event
  ON public.payment_provider_events (provider, provider_environment, event_id)
  WHERE event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.attach_razorpay_subscription_order(
  p_invoice_id uuid,
  p_organization_id uuid,
  p_subscription_id uuid,
  p_provider_environment text,
  p_provider_order_id text,
  p_amount integer,
  p_currency text,
  p_idempotency_key text,
  p_payment_number text,
  p_actor_id uuid,
  p_package_name text,
  p_billing_cycle text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
  v_payment_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_invoice_id IS NULL OR p_organization_id IS NULL OR coalesce(p_provider_order_id, '') = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT', 'error', 'Invoice, organization, and provider order are required.');
  END IF;

  IF coalesce(p_provider_environment, '') NOT IN ('test', 'live') THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_ENVIRONMENT', 'error', 'Provider environment must be test or live.');
  END IF;

  SELECT *
  INTO v_invoice
  FROM public.org_subscription_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVOICE_NOT_FOUND', 'error', 'Invoice not found.');
  END IF;

  IF v_invoice.organization_id <> p_organization_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'ORG_MISMATCH', 'error', 'Invoice does not belong to the organization.');
  END IF;

  IF coalesce(v_invoice.provider_environment, 'test') <> p_provider_environment THEN
    RETURN jsonb_build_object('success', false, 'code', 'ENVIRONMENT_MISMATCH', 'error', 'Invoice provider environment mismatch.');
  END IF;

  IF v_invoice.razorpay_order_id IS NOT NULL AND v_invoice.razorpay_order_id <> p_provider_order_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'ORDER_MISMATCH', 'error', 'Invoice already has a different Razorpay order.');
  END IF;

  IF coalesce(v_invoice.total_amount, v_invoice.subtotal_amount, 0) <> p_amount THEN
    RETURN jsonb_build_object('success', false, 'code', 'AMOUNT_MISMATCH', 'error', 'Order amount does not match invoice total.');
  END IF;

  IF coalesce(v_invoice.currency, 'INR') <> coalesce(p_currency, 'INR') THEN
    RETURN jsonb_build_object('success', false, 'code', 'CURRENCY_MISMATCH', 'error', 'Order currency does not match invoice currency.');
  END IF;

  IF v_invoice.status = 'paid' THEN
    SELECT id
    INTO v_payment_id
    FROM public.org_subscription_payments
    WHERE invoice_id = p_invoice_id
      AND provider = 'razorpay'
      AND provider_order_id = p_provider_order_id
      AND coalesce(provider_environment, 'test') = p_provider_environment
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'invoiceId', p_invoice_id,
      'paymentId', v_payment_id,
      'providerOrderId', p_provider_order_id,
      'alreadyPaid', true
    );
  END IF;

  UPDATE public.org_subscription_invoices
  SET razorpay_order_id = p_provider_order_id,
      status = 'issued',
      updated_at = v_now
  WHERE id = p_invoice_id;

  INSERT INTO public.org_subscription_payments (
    organization_id,
    subscription_id,
    invoice_id,
    payment_number,
    status,
    provider,
    provider_environment,
    provider_order_id,
    amount,
    currency,
    idempotency_key,
    created_at,
    updated_at
  )
  VALUES (
    p_organization_id,
    p_subscription_id,
    p_invoice_id,
    p_payment_number,
    'created',
    'razorpay',
    p_provider_environment,
    p_provider_order_id,
    p_amount,
    p_currency,
    p_idempotency_key,
    v_now,
    v_now
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
  DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    subscription_id = EXCLUDED.subscription_id,
    invoice_id = EXCLUDED.invoice_id,
    provider = EXCLUDED.provider,
    provider_environment = EXCLUDED.provider_environment,
    provider_order_id = EXCLUDED.provider_order_id,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    status = CASE
      WHEN public.org_subscription_payments.status = 'paid' THEN public.org_subscription_payments.status
      ELSE EXCLUDED.status
    END,
    updated_at = v_now
  RETURNING id INTO v_payment_id;

  INSERT INTO public.subscription_events (
    organization_id,
    subscription_id,
    event_type,
    actor_id,
    new_state,
    metadata,
    reason,
    created_at
  )
  VALUES (
    p_organization_id,
    p_subscription_id,
    'razorpay_order_created',
    p_actor_id,
    jsonb_build_object('invoiceId', p_invoice_id, 'orderId', p_provider_order_id, 'amount', p_amount, 'currency', p_currency, 'billingCycle', p_billing_cycle),
    jsonb_build_object('provider', 'razorpay', 'environment', p_provider_environment, 'orderId', p_provider_order_id),
    format('Razorpay order %s created for %s %s', p_provider_order_id, coalesce(p_package_name, 'subscription'), coalesce(p_billing_cycle, 'billing')),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoiceId', p_invoice_id,
    'paymentId', v_payment_id,
    'providerOrderId', p_provider_order_id
  );
END;
$$;

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

  IF v_already_finalized THEN
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
      'payment_duplicate_ignored',
      jsonb_build_object(
        'providerOrderId', p_provider_order_id,
        'providerPaymentId', p_provider_payment_id,
        'invoiceId', v_invoice.id,
        'amount', v_payment.amount
      ),
      'Duplicate Razorpay payment event ignored.',
      jsonb_build_object('eventId', p_event_id, 'providerEnvironment', coalesce(p_provider_environment, 'test')),
      v_now
    );

    RETURN jsonb_build_object(
      'success', true,
      'invoiceId', v_invoice.id,
      'paymentId', v_payment.id,
      'subscriptionId', v_subscription_id,
      'wasAlreadyFinalized', true
    );
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

GRANT EXECUTE ON FUNCTION public.attach_razorpay_subscription_order(uuid, uuid, uuid, text, text, integer, text, text, text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_razorpay_subscription_payment(text, text, text, text) TO service_role;
