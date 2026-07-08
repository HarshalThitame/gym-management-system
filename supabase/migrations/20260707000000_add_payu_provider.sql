-- Add PayU to the payment_gateway_configs provider check constraint
-- This allows gyms to configure PayU as a payment gateway provider.
alter table public.payment_gateway_configs
  drop constraint if exists payment_gateway_configs_provider_check,
  add constraint payment_gateway_configs_provider_check
    check (provider in ('razorpay', 'stripe', 'paypal', 'manual', 'payu'));
