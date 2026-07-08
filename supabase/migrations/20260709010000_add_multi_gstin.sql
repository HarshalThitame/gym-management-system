-- Add per-gym GSTIN support for multi-GSTIN invoicing.
-- Each gym/branch can have its own GST number for GST-compliant invoicing.

alter table public.gyms
  add column if not exists gstin text;

comment on column public.gyms.gstin is 'GSTIN (Goods and Services Tax Identification Number) for this gym/branch. Used as billing_gstin on invoices.';
