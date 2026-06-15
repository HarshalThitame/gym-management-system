-- Enterprise Financial Reporting Views
-- Materialized views for MRR, ARR, revenue trends, and collections

-- ════════════════════════════════════════════════════════════════════════
-- 1. Revenue by package (cached for dashboard performance)
-- ════════════════════════════════════════════════════════════════════════

create or replace view public.financial_revenue_by_package as
select
  p.id as package_id,
  p.name as package_name,
  count(distinct os.organization_id) as subscriber_count,
  coalesce(sum(pp.price), 0) as monthly_revenue,
  coalesce(sum(pp.price) * 12, 0) as annual_revenue
from public.packages p
left join public.organization_subscriptions os on os.package_id = p.id and os.status = 'active'
left join public.package_pricing pp on pp.package_id = p.id and pp.billing_period = 'monthly'
where p.is_active = true
group by p.id, p.name;

comment on view public.financial_revenue_by_package is 'Monthly and annual revenue grouped by package.';

-- ════════════════════════════════════════════════════════════════════════
-- 2. Invoice summary (aggregated)
-- ════════════════════════════════════════════════════════════════════════

create or replace view public.financial_invoice_summary as
select
  status,
  count(*) as invoice_count,
  coalesce(sum(total_amount), 0) as total_amount,
  coalesce(sum(tax_amount), 0) as total_tax,
  coalesce(sum(amount_paid), 0) as total_paid,
  coalesce(sum(amount_due), 0) as total_due
from public.invoices
group by status;

comment on view public.financial_invoice_summary is 'Invoice aggregation by status for collections dashboard.';

-- ════════════════════════════════════════════════════════════════════════
-- 3. Monthly recurring revenue trend (last 12 months)
-- ════════════════════════════════════════════════════════════════════════

create or replace view public.financial_mrr_trend as
select
  date_trunc('month', os.created_at) as month,
  count(distinct os.organization_id) as active_subscriptions,
  coalesce(sum(pp.price), 0) as mrr
from public.organization_subscriptions os
left join public.package_pricing pp on pp.package_id = os.package_id and pp.billing_period = 'monthly'
where os.status = 'active'
  and os.created_at >= date_trunc('month', now()) - interval '12 months'
group by date_trunc('month', os.created_at)
order by month desc;

comment on view public.financial_mrr_trend is 'Monthly recurring revenue trend for the last 12 months.';

-- ════════════════════════════════════════════════════════════════════════
-- 4. Organization billing summary
-- ════════════════════════════════════════════════════════════════════════

create or replace view public.financial_org_billing_summary as
select
  o.id as organization_id,
  o.name as organization_name,
  os.status as subscription_status,
  p.name as package_name,
  coalesce(pp.price, 0) as monthly_price,
  (select count(*) from public.invoices i where i.organization_id = o.id) as invoice_count,
  (select coalesce(sum(total_amount), 0) from public.invoices i where i.organization_id = o.id) as total_billed,
  (select coalesce(sum(amount_paid), 0) from public.invoices i where i.organization_id = o.id) as total_paid,
  (select coalesce(sum(amount_due), 0) from public.invoices i where i.organization_id = o.id) as outstanding
from public.organizations o
left join public.organization_subscriptions os on os.organization_id = o.id
left join public.packages p on p.id = os.package_id
left join public.package_pricing pp on pp.package_id = p.id and pp.billing_period = 'monthly'
where o.status = 'active';

comment on view public.financial_org_billing_summary is 'Per-organization billing summary for collections and reporting.';
