-- Platform payment gateway configuration for Super Admin org-plan billing.
-- This is intentionally separate from gym-level payment_gateway_configs so
-- member membership payments remain organization-scoped while SaaS plan
-- billing stays platform-scoped.

create table if not exists public.platform_payment_gateway_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('razorpay', 'payu')),
  is_active boolean not null default true,
  is_default boolean not null default false,
  priority integer not null default 0 check (priority >= 0),
  test_mode boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  supported_payment_types text[] not null default array['card','upi','net_banking']::text[],
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider)
);

comment on table public.platform_payment_gateway_configs is 'Platform-wide payment gateway configuration used by Super Admin org-plan billing.';
comment on column public.platform_payment_gateway_configs.config is 'Encrypted gateway credential bundle for org-plan billing and platform checkout flows.';

drop trigger if exists set_platform_payment_gateway_configs_updated_at on public.platform_payment_gateway_configs;
create trigger set_platform_payment_gateway_configs_updated_at
before update on public.platform_payment_gateway_configs
for each row execute function public.set_updated_at();

alter table public.platform_payment_gateway_configs enable row level security;

drop policy if exists "platform payment gateway configs readable by super admins" on public.platform_payment_gateway_configs;
create policy "platform payment gateway configs readable by super admins"
on public.platform_payment_gateway_configs for select to authenticated
using (public.is_super_admin());

drop policy if exists "platform payment gateway configs insertable by super admins" on public.platform_payment_gateway_configs;
create policy "platform payment gateway configs insertable by super admins"
on public.platform_payment_gateway_configs for insert to authenticated
with check (public.is_super_admin());

drop policy if exists "platform payment gateway configs updatable by super admins" on public.platform_payment_gateway_configs;
create policy "platform payment gateway configs updatable by super admins"
on public.platform_payment_gateway_configs for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "platform payment gateway configs deletable by super admins" on public.platform_payment_gateway_configs;
create policy "platform payment gateway configs deletable by super admins"
on public.platform_payment_gateway_configs for delete to authenticated
using (public.is_super_admin());
