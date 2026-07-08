-- Add payment_link column to invoices table to store the short URL directly
-- This eliminates N+1 Razorpay API calls when loading the payment links page.

alter table public.invoices
  add column if not exists payment_link text;

comment on column public.invoices.payment_link is 'Short URL for the Razorpay payment link. Stored here to avoid N+1 API calls.';
