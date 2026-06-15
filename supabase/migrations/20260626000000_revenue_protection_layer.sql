-- Revenue Protection Layer
-- Adds payment deduplication, idempotency tracking, and enhanced audit

-- ════════════════════════════════════════════════════════════════════════
-- 1. Payment idempotency tracking (prevents duplicate charges)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.payment_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount int not null,
  status text not null default 'completed' check (status in ('completed', 'failed', 'processing')),
  response jsonb,
  created_at timestamptz not null default now()
);

comment on table public.payment_idempotency_keys is 'Ensures payment requests are processed exactly once. Prevents double charges.';

create index if not exists idempotency_key_idx on public.payment_idempotency_keys (idempotency_key);
create index if not exists idempotency_org_idx on public.payment_idempotency_keys (organization_id);

alter table public.payment_idempotency_keys enable row level security;

drop policy if exists "idempotency super admin" on public.payment_idempotency_keys;
create policy "idempotency super admin"
  on public.payment_idempotency_keys for select to authenticated
  using (public.is_super_admin());

drop policy if exists "idempotency insert" on public.payment_idempotency_keys;
create policy "idempotency insert"
  on public.payment_idempotency_keys for insert to authenticated
  with check (public.is_super_admin());

-- ════════════════════════════════════════════════════════════════════════
-- 2. Invoice locking (prevents double-generation of renewal invoices)
-- ════════════════════════════════════════════════════════════════════════

alter table public.invoices add column if not exists lock_key text unique;
comment on column public.invoices.lock_key is 'Unique key to prevent duplicate invoice generation (e.g. renewal-{sub_id}-{period})';

-- ════════════════════════════════════════════════════════════════════════
-- 3. RLS for billing tables (ensure org isolation)
-- ════════════════════════════════════════════════════════════════════════

-- Ensure RLS is enabled on all billing tables
alter table public.invoice_items enable row level security;

drop policy if exists "invoice_items super admin" on public.invoice_items;
create policy "invoice_items super admin"
  on public.invoice_items for select to authenticated
  using (public.is_super_admin());

drop policy if exists "invoice_items org owner via invoice" on public.invoice_items;
create policy "invoice_items org owner via invoice"
  on public.invoice_items for select to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
      and (public.is_super_admin() or public.is_organization_owner(i.organization_id))
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- 4. Trigger: auto-update invoice totals when items change
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.recalculate_invoice_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invoices set
    subtotal = coalesce((select sum(amount) from public.invoice_items where invoice_id = new.invoice_id), 0),
    tax_amount = coalesce((select sum(tax_amount) from public.invoice_items where invoice_id = new.invoice_id), 0),
    total_amount = coalesce((select sum(amount + tax_amount) from public.invoice_items where invoice_id = new.invoice_id), 0),
    amount_due = coalesce((select sum(amount + tax_amount) from public.invoice_items where invoice_id = new.invoice_id), 0) - amount_paid
  where id = new.invoice_id;
  return new;
end;
$$;

drop trigger if exists recalc_invoice_on_item_change on public.invoice_items;
create trigger recalc_invoice_on_item_change
  after insert or update or delete on public.invoice_items
  for each row
  execute function public.recalculate_invoice_totals();
