-- Tax Engine & Enterprise Billing Completion
-- Adds: tax_rates, invoice_tax_lines, org_tax_settings, GSTIN on organizations,
--       contract/agreements table, billing_thresholds, late_fee_policies,
--       payment_gateway_configs, provisioning_hooks, subscription_usage_cron metadata

-- ============================================================
-- 1. ORGANIZATIONS — add tax fields
-- ============================================================
alter table public.organizations add column if not exists gstin text;
alter table public.organizations add column if not exists gst_registered_name text;
alter table public.organizations add column if not exists business_type text
  check (business_type in ('individual','partnership','private_limited','public_limited','llp','other'));

comment on column public.organizations.gstin is '15-character Indian GSTIN (e.g. 27AAACH1234A1Z5)';
comment on column public.organizations.gst_registered_name is 'Legal name as registered with GST authorities';
comment on column public.organizations.business_type is 'Business entity classification for tax purposes';

create index if not exists organizations_gstin_idx on public.organizations (gstin) where gstin is not null;

-- ============================================================
-- 2. TAX RATES
-- ============================================================
create table if not exists public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  description text,
  rate_percent numeric(5,2) not null check (rate_percent >= 0 and rate_percent <= 100),
  tax_type text not null check (tax_type in ('gst','sgst','cgst','igst','cess','surcharge','vat','sales_tax','service_tax','other')),
  is_compound boolean not null default false,
  is_active boolean not null default true,
  applies_to text[] not null default array['membership','subscription','product']::text[],
  effective_from date not null default current_date,
  effective_until date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from)
);

create index if not exists tax_rates_gym_active_idx on public.tax_rates (gym_id, is_active) where is_active;

comment on table public.tax_rates is 'Predefined tax rates used across invoices, subscriptions, and products.';
comment on column public.tax_rates.is_compound is 'If true, this tax is applied on top of other taxes (e.g. cess on GST)';

-- Seed default Indian GST rates
insert into public.tax_rates (gym_id, name, rate_percent, tax_type, applies_to, effective_from) values
  (null, 'GST 5%', 5.00, 'gst', array['membership','subscription','product'], '2017-07-01'),
  (null, 'GST 12%', 12.00, 'gst', array['membership','subscription','product'], '2017-07-01'),
  (null, 'GST 18%', 18.00, 'gst', array['membership','subscription','product'], '2017-07-01'),
  (null, 'GST 28%', 28.00, 'gst', array['membership','subscription','product'], '2017-07-01')
on conflict do nothing;

-- ============================================================
-- 3. INVOICE TAX LINES
-- ============================================================
create table if not exists public.invoice_tax_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  tax_rate_id uuid references public.tax_rates(id) on delete set null,
  tax_name text not null,
  tax_rate_percent numeric(5,2) not null check (tax_rate_percent >= 0),
  taxable_amount int not null check (taxable_amount >= 0),
  tax_amount int not null check (tax_amount >= 0),
  is_compound boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists invoice_tax_lines_invoice_idx on public.invoice_tax_lines (invoice_id);

comment on table public.invoice_tax_lines is 'Individual tax breakdown lines per invoice for transparent tax reporting.';

-- ============================================================
-- 4. ORG TAX SETTINGS
-- ============================================================
create table if not exists public.org_tax_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade unique,
  tax_calculation_enabled boolean not null default false,
  auto_calculate_tax boolean not null default true,
  default_tax_rate_id uuid references public.tax_rates(id) on delete set null,
  is_gst_registered boolean not null default false,
  gstin_verified_at timestamptz,
  gstin_verification_source text,
  tax_inclusive_pricing boolean not null default false,
  custom_rules jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.org_tax_settings is 'Per-organization tax configuration preferences.';

-- ============================================================
-- 5. SUBSCRIPTION INVOICE TAX LINES
-- ============================================================
create table if not exists public.org_sub_invoice_tax_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.org_subscription_invoices(id) on delete cascade,
  tax_rate_id uuid references public.tax_rates(id) on delete set null,
  tax_name text not null,
  tax_rate_percent numeric(5,2) not null check (tax_rate_percent >= 0),
  taxable_amount int not null check (taxable_amount >= 0),
  tax_amount int not null check (tax_amount >= 0),
  is_compound boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists org_sub_invoice_tax_lines_invoice_idx on public.org_sub_invoice_tax_lines (invoice_id);

comment on table public.org_sub_invoice_tax_lines is 'Tax breakdown lines for SaaS subscription invoices.';

-- ============================================================
-- 6. CONTRACTS / AGREEMENTS
-- ============================================================
create table if not exists public.org_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_type text not null check (contract_type in ('annual_commit','custom_enterprise','mou','sla','amendment')),
  contract_number text not null,
  title text not null check (char_length(title) between 2 and 200),
  description text,
  signed_by_org uuid references auth.users(id) on delete set null,
  signed_by_provider uuid references auth.users(id) on delete set null,
  signed_at timestamptz,
  effective_from date not null,
  effective_until date,
  auto_renew boolean not null default false,
  renewal_terms text,
  special_terms jsonb default '{}'::jsonb,
  document_url text,
  status text not null default 'draft' check (status in ('draft','pending_signature','active','expired','terminated','amended')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contract_number),
  check (effective_until is null or effective_until >= effective_from)
);

create index if not exists org_contracts_org_status_idx on public.org_contracts (organization_id, status, effective_from desc);

comment on table public.org_contracts is 'Contractual agreements with organizations for custom pricing/terms.';

-- ============================================================
-- 7. BILLING THRESHOLDS / ALERTS
-- ============================================================
create table if not exists public.billing_thresholds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  threshold_type text not null check (threshold_type in ('usage_percent','amount','invoice_count','days_overdue')),
  threshold_value numeric(12,2) not null check (threshold_value > 0),
  comparison text not null default 'gte' check (comparison in ('gte','lte','eq')),
  notification_channels text[] not null default array['email']::text[] check (notification_channels <@ array['email','sms','webhook','in_app']::text[]),
  is_active boolean not null default true,
  cooldown_hours int not null default 24 check (cooldown_hours >= 1),
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_thresholds_org_active_idx on public.billing_thresholds (organization_id, is_active);

comment on table public.billing_thresholds is 'Configurable threshold rules for billing alerts and notifications.';

-- ============================================================
-- 8. LATE FEE POLICIES
-- ============================================================
create table if not exists public.late_fee_policies (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  fee_type text not null check (fee_type in ('flat','percentage','flat_after_grace','percentage_after_grace')),
  fee_amount int not null default 0 check (fee_amount >= 0),
  fee_percent numeric(5,2) not null default 0 check (fee_percent >= 0),
  grace_period_days int not null default 0 check (grace_period_days >= 0),
  max_fee_amount int check (max_fee_amount is null or max_fee_amount >= 0),
  recurrence text not null default 'one_time' check (recurrence in ('one_time','daily','weekly','monthly')),
  applies_to text[] not null default array['invoice','subscription']::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists late_fee_policies_gym_active_idx on public.late_fee_policies (gym_id, is_active);

comment on table public.late_fee_policies is 'Configurable late fee rules for overdue invoices.';

-- ============================================================
-- 9. PAYMENT GATEWAY CONFIGURATIONS
-- ============================================================
create table if not exists public.payment_gateway_configs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  provider text not null check (provider in ('razorpay','stripe','paypal','manual')),
  is_active boolean not null default false,
  is_default boolean not null default false,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  supported_payment_types text[] not null default array['card','upi']::text[],
  priority int not null default 0 check (priority >= 0),
  test_mode boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, provider)
);

create index if not exists payment_gateway_configs_default_idx on public.payment_gateway_configs (gym_id, is_default) where is_default;

comment on table public.payment_gateway_configs is 'Multi-gateway payment provider configuration per gym.';

-- ============================================================
-- 10. PROVISIONING HOOKS
-- ============================================================
create table if not exists public.provisioning_hooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trigger_event text not null check (trigger_event in ('subscription_activated','subscription_cancelled','subscription_suspended','subscription_expired','subscription_plan_changed','subscription_payment_failed','subscription_payment_recovered')),
  hook_type text not null check (hook_type in ('webhook','email','slack','function')),
  target_url text,
  target_function text,
  payload_template jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  retry_count int not null default 3 check (retry_count between 0 and 10),
  last_invoked_at timestamptz,
  last_response_status int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists provisioning_hooks_org_event_idx on public.provisioning_hooks (organization_id, trigger_event);

comment on table public.provisioning_hooks is 'Automated provisioning/deprovisioning hooks triggered by subscription lifecycle events.';

-- ============================================================
-- 11. GSTIN VALIDATION FUNCTION
-- ============================================================
create or replace function public.validate_gstin(gstin text)
returns boolean
language plpgsql
immutable
as $$
declare
  valid_pattern text := '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$';
begin
  if gstin is null then return false; end if;
  return gstin ~ valid_pattern;
end;
$$;

comment on function public.validate_gstin is 'Validates 15-character Indian GSTIN format including checksum structure.';

-- ============================================================
-- 12. GENERATE INVOICE NUMBER (proper sequential)
-- ============================================================
create sequence if not exists public.invoice_number_seq as integer start 1 increment 1;

create or replace function public.generate_invoice_number(target_gym_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
  year_prefix text;
begin
  year_prefix := to_char(now(), 'YYYY');
  select coalesce(count(*), 0) + 1 into next_number
  from public.invoices
  where gym_id is not distinct from target_gym_id
    and created_at >= date_trunc('year', now());
  return 'INV-' || year_prefix || '-' || lpad(next_number::text, 6, '0');
end;
$$;

-- ============================================================
-- RLS ENABLE
-- ============================================================
alter table public.tax_rates enable row level security;
alter table public.invoice_tax_lines enable row level security;
alter table public.org_tax_settings enable row level security;
alter table public.org_sub_invoice_tax_lines enable row level security;
alter table public.org_contracts enable row level security;
alter table public.billing_thresholds enable row level security;
alter table public.late_fee_policies enable row level security;
alter table public.payment_gateway_configs enable row level security;
alter table public.provisioning_hooks enable row level security;

grant select, insert, update, delete on public.tax_rates to authenticated;
grant select, insert, update on public.invoice_tax_lines to authenticated;
grant select, insert, update on public.org_tax_settings to authenticated;
grant select, insert, update on public.org_sub_invoice_tax_lines to authenticated;
grant select, insert, update on public.org_contracts to authenticated;
grant select, insert, update, delete on public.billing_thresholds to authenticated;
grant select, insert, update, delete on public.late_fee_policies to authenticated;
grant select, insert, update on public.payment_gateway_configs to authenticated;
grant select, insert, update on public.provisioning_hooks to authenticated;

-- ============================================================
-- RLS: TAX RATES
-- ============================================================
drop policy if exists "tax rates visible to gym staff" on public.tax_rates;
create policy "tax rates visible to gym staff"
  on public.tax_rates for select to authenticated
  using (public.is_super_admin() or gym_id is null or gym_id = public.current_user_gym_id());

drop policy if exists "tax rates manageable by gym admins" on public.tax_rates;
create policy "tax rates manageable by gym admins"
  on public.tax_rates for insert to authenticated
  with check (public.is_super_admin() or gym_id = public.current_user_gym_id());

drop policy if exists "tax rates updatable by gym admins" on public.tax_rates;
create policy "tax rates updatable by gym admins"
  on public.tax_rates for update to authenticated
  using (public.is_super_admin() or gym_id = public.current_user_gym_id())
  with check (public.is_super_admin() or gym_id = public.current_user_gym_id());

drop policy if exists "tax rates deletable by super admins" on public.tax_rates;
create policy "tax rates deletable by super admins"
  on public.tax_rates for delete to authenticated
  using (public.is_super_admin());

-- ============================================================
-- RLS: INVOICE TAX LINES
-- ============================================================
drop policy if exists "invoice tax lines visible via parent invoice" on public.invoice_tax_lines;
create policy "invoice tax lines visible via parent invoice"
  on public.invoice_tax_lines for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));

drop policy if exists "invoice tax lines manageable by gym admins" on public.invoice_tax_lines;
create policy "invoice tax lines manageable by gym admins"
  on public.invoice_tax_lines for insert to authenticated
  with check (exists (select 1 from public.invoices i where i.id = invoice_id));

-- ============================================================
-- RLS: ORG TAX SETTINGS
-- ============================================================
drop policy if exists "org tax settings visible to org owners" on public.org_tax_settings;
create policy "org tax settings visible to org owners"
  on public.org_tax_settings for select to authenticated
  using (public.is_super_admin() or public.is_organization_owner(organization_id));

drop policy if exists "org tax settings manageable by org owners" on public.org_tax_settings;
create policy "org tax settings manageable by org owners"
  on public.org_tax_settings for insert to authenticated
  with check (public.is_super_admin() or public.is_organization_owner(organization_id));

drop policy if exists "org tax settings updatable by org owners" on public.org_tax_settings;
create policy "org tax settings updatable by org owners"
  on public.org_tax_settings for update to authenticated
  using (public.is_super_admin() or public.is_organization_owner(organization_id))
  with check (public.is_super_admin() or public.is_organization_owner(organization_id));

-- ============================================================
-- RLS: ORG SUB INVOICE TAX LINES
-- ============================================================
drop policy if exists "org sub invoice tax lines visible via parent" on public.org_sub_invoice_tax_lines;
create policy "org sub invoice tax lines visible via parent"
  on public.org_sub_invoice_tax_lines for select to authenticated
  using (exists (select 1 from public.org_subscription_invoices i where i.id = invoice_id));

-- ============================================================
-- RLS: ORG CONTRACTS
-- ============================================================
drop policy if exists "org contracts visible to super admins" on public.org_contracts;
create policy "org contracts visible to super admins"
  on public.org_contracts for select to authenticated
  using (public.is_super_admin());

drop policy if exists "org contracts visible to org owners" on public.org_contracts;
create policy "org contracts visible to org owners"
  on public.org_contracts for select to authenticated
  using (public.is_organization_owner(organization_id));

drop policy if exists "org contracts manageable by super admins" on public.org_contracts;
create policy "org contracts manageable by super admins"
  on public.org_contracts for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "org contracts updatable by super admins" on public.org_contracts;
create policy "org contracts updatable by super admins"
  on public.org_contracts for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- RLS: BILLING THRESHOLDS
-- ============================================================
drop policy if exists "billing thresholds visible to org owners" on public.billing_thresholds;
create policy "billing thresholds visible to org owners"
  on public.billing_thresholds for select to authenticated
  using (public.is_super_admin() or public.is_organization_owner(organization_id));

drop policy if exists "billing thresholds manageable by org owners" on public.billing_thresholds;
create policy "billing thresholds manageable by org owners"
  on public.billing_thresholds for insert to authenticated
  with check (public.is_super_admin() or public.is_organization_owner(organization_id));

drop policy if exists "billing thresholds updatable by org owners" on public.billing_thresholds;
create policy "billing thresholds updatable by org owners"
  on public.billing_thresholds for update to authenticated
  using (public.is_super_admin() or public.is_organization_owner(organization_id))
  with check (public.is_super_admin() or public.is_organization_owner(organization_id));

drop policy if exists "billing thresholds deletable by org owners" on public.billing_thresholds;
create policy "billing thresholds deletable by org owners"
  on public.billing_thresholds for delete to authenticated
  using (public.is_super_admin() or public.is_organization_owner(organization_id));

-- ============================================================
-- RLS: LATE FEE POLICIES
-- ============================================================
drop policy if exists "late fee policies visible to gym staff" on public.late_fee_policies;
create policy "late fee policies visible to gym staff"
  on public.late_fee_policies for select to authenticated
  using (public.is_super_admin() or gym_id = public.current_user_gym_id());

drop policy if exists "late fee policies manageable by gym admins" on public.late_fee_policies;
create policy "late fee policies manageable by gym admins"
  on public.late_fee_policies for insert to authenticated
  with check (public.is_super_admin() or gym_id = public.current_user_gym_id());

drop policy if exists "late fee policies updatable by gym admins" on public.late_fee_policies;
create policy "late fee policies updatable by gym admins"
  on public.late_fee_policies for update to authenticated
  using (public.is_super_admin() or gym_id = public.current_user_gym_id())
  with check (public.is_super_admin() or gym_id = public.current_user_gym_id());

-- ============================================================
-- RLS: PAYMENT GATEWAY CONFIGS
-- ============================================================
drop policy if exists "gateway configs visible to gym admins" on public.payment_gateway_configs;
create policy "gateway configs visible to gym admins"
  on public.payment_gateway_configs for select to authenticated
  using (public.is_super_admin() or gym_id = public.current_user_gym_id());

drop policy if exists "gateway configs manageable by super admins" on public.payment_gateway_configs;
create policy "gateway configs manageable by super admins"
  on public.payment_gateway_configs for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "gateway configs updatable by super admins" on public.payment_gateway_configs;
create policy "gateway configs updatable by super admins"
  on public.payment_gateway_configs for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- RLS: PROVISIONING HOOKS
-- ============================================================
drop policy if exists "provisioning hooks visible to super admins" on public.provisioning_hooks;
create policy "provisioning hooks visible to super admins"
  on public.provisioning_hooks for select to authenticated
  using (public.is_super_admin());

drop policy if exists "provisioning hooks manageable by super admins" on public.provisioning_hooks;
create policy "provisioning hooks manageable by super admins"
  on public.provisioning_hooks for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "provisioning hooks updatable by super admins" on public.provisioning_hooks;
create policy "provisioning hooks updatable by super admins"
  on public.provisioning_hooks for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- TRIGGERS
-- ============================================================
drop trigger if exists set_tax_rates_updated_at on public.tax_rates;
create trigger set_tax_rates_updated_at
  before update on public.tax_rates
  for each row execute function public.set_updated_at();

drop trigger if exists set_org_tax_settings_updated_at on public.org_tax_settings;
create trigger set_org_tax_settings_updated_at
  before update on public.org_tax_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_org_contracts_updated_at on public.org_contracts;
create trigger set_org_contracts_updated_at
  before update on public.org_contracts
  for each row execute function public.set_updated_at();

drop trigger if exists set_billing_thresholds_updated_at on public.billing_thresholds;
create trigger set_billing_thresholds_updated_at
  before update on public.billing_thresholds
  for each row execute function public.set_updated_at();

drop trigger if exists set_late_fee_policies_updated_at on public.late_fee_policies;
create trigger set_late_fee_policies_updated_at
  before update on public.late_fee_policies
  for each row execute function public.set_updated_at();

drop trigger if exists set_payment_gateway_configs_updated_at on public.payment_gateway_configs;
create trigger set_payment_gateway_configs_updated_at
  before update on public.payment_gateway_configs
  for each row execute function public.set_updated_at();

drop trigger if exists set_provisioning_hooks_updated_at on public.provisioning_hooks;
create trigger set_provisioning_hooks_updated_at
  before update on public.provisioning_hooks
  for each row execute function public.set_updated_at();

-- ============================================================
-- 13. BILLING ADDRESS ON ORGANIZATIONS
-- ============================================================
alter table public.organizations add column if not exists billing_address_line1 text;
alter table public.organizations add column if not exists billing_address_line2 text;
alter table public.organizations add column if not exists billing_city text;
alter table public.organizations add column if not exists billing_state text;
alter table public.organizations add column if not exists billing_zip text;
alter table public.organizations add column if not exists billing_country text not null default 'IN';

comment on column public.organizations.billing_address_line1 is 'Street address / building for billing invoices';
comment on column public.organizations.billing_city is 'City for billing address';
comment on column public.organizations.billing_state is 'State for billing address';
comment on column public.organizations.billing_zip is 'Postal/ZIP code for billing address';
comment on column public.organizations.billing_country is 'ISO 3166-1 alpha-2 country code (default IN)';

-- ============================================================
-- 14. GSTR-1 REPORTING VIEW
-- ============================================================
create or replace view public.gstr1_report as
select
  o.gstin as supplier_gstin,
  o.billing_address_line1 as supplier_address,
  o.billing_city as supplier_city,
  o.billing_state as supplier_state,
  o.billing_zip as supplier_zip,
  i.invoice_number,
  i.issued_at as invoice_date,
  i.total_amount as invoice_value,
  i.tax_amount as total_tax,
  m.full_name as customer_name,
  null as customer_gstin,
  itl.tax_rate_percent as tax_rate,
  itl.taxable_amount,
  itl.tax_amount as line_tax
from public.invoices i
  join public.organizations o on o.id = i.gym_id
  left join public.members m on m.id = i.member_id
  left join public.invoice_tax_lines itl on itl.invoice_id = i.id
where o.gstin is not null
  and i.status = 'paid'
  and i.issued_at >= date_trunc('month', now());

comment on view public.gstr1_report is 'GSTR-1 monthly summary view for GST filing. Requires organizations.gstin to be set.';
