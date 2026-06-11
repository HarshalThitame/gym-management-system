create or replace function public.financial_invoice_scope_matches(row_gym_id uuid, row_member_id uuid, row_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members
    where members.id = row_member_id
      and members.gym_id is not distinct from row_gym_id
  )
  and (
    row_membership_id is null
    or exists (
      select 1
      from public.memberships
      where memberships.id = row_membership_id
        and memberships.member_id = row_member_id
        and memberships.gym_id is not distinct from row_gym_id
    )
  );
$$;

create or replace function public.financial_payment_scope_matches(
  row_gym_id uuid,
  row_member_id uuid,
  row_membership_id uuid,
  row_invoice_id uuid,
  row_amount integer
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.financial_invoice_scope_matches(row_gym_id, row_member_id, row_membership_id)
  and (
    row_invoice_id is null
    or exists (
      select 1
      from public.invoices
      where invoices.id = row_invoice_id
        and invoices.member_id = row_member_id
        and invoices.gym_id is not distinct from row_gym_id
        and (
          row_membership_id is null
          or invoices.membership_id is null
          or invoices.membership_id = row_membership_id
        )
        and row_amount <= invoices.total_amount
    )
  );
$$;

create or replace function public.enforce_invoice_financial_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.financial_invoice_scope_matches(new.gym_id, new.member_id, new.membership_id) then
    raise exception 'Invoice member, membership, and gym must match.'
      using errcode = '23514';
  end if;

  if new.amount_paid > greatest(new.subtotal_amount - new.discount_amount + new.tax_amount, 0) then
    raise exception 'Invoice amount paid cannot exceed invoice total.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_payment_financial_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.financial_payment_scope_matches(new.gym_id, new.member_id, new.membership_id, new.invoice_id, new.amount) then
    raise exception 'Payment member, membership, invoice, and gym must match.'
      using errcode = '23514';
  end if;

  if new.provider = 'razorpay'
    and new.status in ('paid', 'partially_refunded', 'refunded')
    and new.provider_payment_id is null then
    raise exception 'Finalized Razorpay payments require a provider payment id.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_refund_financial_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.payments%rowtype;
  committed_refund_total integer;
begin
  select *
  into payment_record
  from public.payments
  where payments.id = new.payment_id;

  if not found then
    raise exception 'Refund payment does not exist.'
      using errcode = '23514';
  end if;

  if new.gym_id is distinct from payment_record.gym_id
    or new.member_id <> payment_record.member_id
    or (new.invoice_id is not null and payment_record.invoice_id is not null and new.invoice_id <> payment_record.invoice_id) then
    raise exception 'Refund member, payment, invoice, and gym must match.'
      using errcode = '23514';
  end if;

  if new.amount > payment_record.amount then
    raise exception 'Refund amount cannot exceed payment amount.'
      using errcode = '23514';
  end if;

  select coalesce(sum(refunds.amount), 0)
  into committed_refund_total
  from public.refunds
  where refunds.payment_id = new.payment_id
    and refunds.id <> new.id
    and refunds.status in ('approved', 'processing', 'processed');

  if new.status in ('approved', 'processing', 'processed')
    and committed_refund_total + new.amount > payment_record.amount then
    raise exception 'Committed refunds cannot exceed payment amount.'
      using errcode = '23514';
  end if;

  if payment_record.provider = 'razorpay'
    and new.status in ('processing', 'processed')
    and new.provider_refund_id is null then
    raise exception 'Processed Razorpay refunds require a provider refund id.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

alter table public.invoices
drop constraint if exists invoices_amount_paid_not_above_total_chk;

alter table public.invoices
add constraint invoices_amount_paid_not_above_total_chk
check (amount_paid <= greatest(subtotal_amount - discount_amount + tax_amount, 0)) not valid;

drop trigger if exists enforce_invoice_financial_integrity on public.invoices;
create trigger enforce_invoice_financial_integrity
before insert or update on public.invoices
for each row execute function public.enforce_invoice_financial_integrity();

drop trigger if exists enforce_payment_financial_integrity on public.payments;
create trigger enforce_payment_financial_integrity
before insert or update on public.payments
for each row execute function public.enforce_payment_financial_integrity();

drop trigger if exists enforce_refund_financial_integrity on public.refunds;
create trigger enforce_refund_financial_integrity
before insert or update on public.refunds
for each row execute function public.enforce_refund_financial_integrity();

drop policy if exists "staff can write invoices" on public.invoices;
create policy "staff can write invoices"
on public.invoices for all to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
    and public.financial_invoice_scope_matches(gym_id, member_id, membership_id)
  )
)
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
    and public.financial_invoice_scope_matches(gym_id, member_id, membership_id)
  )
);

drop policy if exists "staff can write payments" on public.payments;
create policy "staff can write payments"
on public.payments for all to authenticated
using (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
    and public.financial_payment_scope_matches(gym_id, member_id, membership_id, invoice_id, amount)
  )
)
with check (
  public.is_super_admin()
  or (
    gym_id = public.current_user_gym_id()
    and public.has_any_role(array['gym_admin', 'reception_staff'])
    and public.financial_payment_scope_matches(gym_id, member_id, membership_id, invoice_id, amount)
  )
);

drop policy if exists "staff can manage refunds" on public.refunds;

drop policy if exists "service role can manage refunds" on public.refunds;
create policy "service role can manage refunds"
on public.refunds for all to service_role
using (true)
with check (true);
