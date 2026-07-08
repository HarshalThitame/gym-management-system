-- Link org subscription invoices and payments to the saved organization payment method.
-- This keeps the money trail explicit without changing the existing billing flow.

ALTER TABLE public.org_subscription_invoices
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES public.org_payment_methods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS org_sub_invoices_payment_method_idx
  ON public.org_subscription_invoices (payment_method_id)
  WHERE payment_method_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_org_subscription_payment_method_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_method_id IS NULL AND NEW.invoice_id IS NOT NULL THEN
    SELECT i.payment_method_id
      INTO NEW.payment_method_id
    FROM public.org_subscription_invoices i
    WHERE i.id = NEW.invoice_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_org_subscription_payment_method_from_invoice ON public.org_subscription_payments;
CREATE TRIGGER set_org_subscription_payment_method_from_invoice
  BEFORE INSERT OR UPDATE OF invoice_id ON public.org_subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_org_subscription_payment_method_from_invoice();

CREATE OR REPLACE FUNCTION public.sync_org_subscription_payments_method_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_method_id IS NOT NULL THEN
    UPDATE public.org_subscription_payments
      SET payment_method_id = NEW.payment_method_id
    WHERE invoice_id = NEW.id
      AND payment_method_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_org_subscription_payments_method_from_invoice ON public.org_subscription_invoices;
CREATE TRIGGER sync_org_subscription_payments_method_from_invoice
  AFTER INSERT OR UPDATE OF payment_method_id ON public.org_subscription_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_org_subscription_payments_method_from_invoice();
