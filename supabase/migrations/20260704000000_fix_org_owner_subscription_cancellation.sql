-- Align database subscription transitions with the application state machine
-- and make organization-owner cancellation atomic and auditable.

CREATE OR REPLACE FUNCTION public.validate_subscription_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  valid boolean;
BEGIN
  IF tg_op = 'INSERT' THEN
    IF new.status NOT IN ('active', 'trial', 'expired', 'suspended', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid subscription status: %', new.status;
    END IF;
    RETURN new;
  END IF;

  IF new.status = old.status THEN
    RETURN new;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM (VALUES
      ('trial', 'active'),
      ('trial', 'expired'),
      ('trial', 'suspended'),
      ('trial', 'cancelled'),
      ('active', 'suspended'),
      ('active', 'expired'),
      ('active', 'cancelled'),
      ('suspended', 'active'),
      ('suspended', 'expired'),
      ('suspended', 'cancelled'),
      ('expired', 'active'),
      ('expired', 'cancelled'),
      ('cancelled', 'expired')
    ) AS transitions(from_status, to_status)
    WHERE transitions.from_status = old.status
      AND transitions.to_status = new.status
  ) INTO valid;

  IF NOT valid THEN
    RAISE EXCEPTION 'Invalid subscription status transition: % -> %', old.status, new.status;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS enforce_subscription_status_transition ON public.organization_subscriptions;
CREATE TRIGGER enforce_subscription_status_transition
  BEFORE UPDATE OF status ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_subscription_status_transition();

CREATE OR REPLACE FUNCTION public.cancel_organization_subscription(
  p_organization_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_terms_accepted boolean,
  p_no_refund_acknowledged boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription record;
  v_now timestamptz := now();
  v_cancel_at timestamptz;
BEGIN
  IF p_organization_id IS NULL OR p_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_SCOPE', 'error', 'Organization and actor are required.');
  END IF;

  IF length(trim(coalesce(p_reason, ''))) < 10 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_REASON', 'error', 'Cancellation reason must contain at least 10 characters.');
  END IF;

  IF NOT coalesce(p_terms_accepted, false) OR NOT coalesce(p_no_refund_acknowledged, false) THEN
    RETURN jsonb_build_object('success', false, 'code', 'ACKNOWLEDGEMENT_REQUIRED', 'error', 'Accept the cancellation terms and no-refund acknowledgement.');
  END IF;

  SELECT *
  INTO v_subscription
  FROM public.organization_subscriptions
  WHERE organization_id = p_organization_id
    AND status IN ('active', 'trial')
  ORDER BY started_at DESC NULLS LAST, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'ACTIVE_SUBSCRIPTION_NOT_FOUND', 'error', 'No active or trial subscription found for this organization.');
  END IF;

  -- Schedule cancellation at end of billing period: use next_billing_date when available,
  -- otherwise fall back to 30 days from now (monthly default).
  -- Clamp to at least tomorrow so the cancel is never immediate from a stale next_billing_date.
  v_cancel_at := greatest(
    coalesce(v_subscription.next_billing_date, v_now + interval '30 days'),
    v_now + interval '1 day'
  );

  UPDATE public.organization_subscriptions
  SET status = 'active',
      auto_renew = false,
      cancelled_at = v_cancel_at,
      expires_at = least(coalesce(expires_at, v_cancel_at), v_cancel_at),
      cancellation_reason = trim(p_reason),
      cancellation_category = coalesce(cancellation_category, 'organization_requested'),
      data_retention_days = 30,
      updated_at = v_now
  WHERE id = v_subscription.id;

  INSERT INTO public.subscription_events (
    organization_id,
    subscription_id,
    event_type,
    actor_id,
    new_state,
    reason,
    metadata,
    created_at
  )
  VALUES (
    p_organization_id,
    v_subscription.id,
    'cancellation_scheduled',
    p_actor_id,
    jsonb_build_object(
      'status', 'active',
      'autoRenew', false,
      'cancelledAt', v_cancel_at,
      'dataRetentionDays', 30,
      'scheduledEndDate', v_cancel_at
    ),
    trim(p_reason),
    jsonb_build_object(
      'source', 'organization_owner',
      'previousState', jsonb_build_object('status', v_subscription.status, 'autoRenew', v_subscription.auto_renew),
      'termsAccepted', true,
      'noRefundAcknowledged', true,
      'irreversibleAcknowledged', true
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscriptionId', v_subscription.id,
    'scheduledCancelAt', v_cancel_at,
    'dataRetentionDays', 30
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_organization_subscription(uuid, uuid, text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_organization_subscription(uuid, uuid, text, boolean, boolean) TO service_role;
