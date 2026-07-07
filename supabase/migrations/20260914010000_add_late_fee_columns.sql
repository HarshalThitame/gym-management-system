-- Add dedicated late_fee_amount columns instead of misusing tax_amount

alter table public.org_subscription_invoices
  add column if not exists late_fee_amount integer not null default 0
  check (late_fee_amount >= 0);

comment on column public.org_subscription_invoices.late_fee_amount is 'Late fee amount in paise applied to this invoice. Separate from tax_amount for correct accounting.';

alter table public.invoices
  add column if not exists late_fee_amount integer not null default 0
  check (late_fee_amount >= 0);

comment on column public.invoices.late_fee_amount is 'Late fee amount in paise applied to this invoice. Separate from tax_amount for correct accounting.';
