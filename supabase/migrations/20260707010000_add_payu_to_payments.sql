-- Add PayU as a supported payment provider and method
-- This allows the payments table to store PayU transactions.

alter table public.payments
  drop constraint if exists payments_provider_check,
  add constraint payments_provider_check
    check (provider in ('manual', 'razorpay', 'payu'));

alter table public.payments
  drop constraint if exists payments_method_check,
  add constraint payments_method_check
    check (method in ('cash', 'upi', 'credit_card', 'debit_card', 'net_banking', 'razorpay', 'payu'));
