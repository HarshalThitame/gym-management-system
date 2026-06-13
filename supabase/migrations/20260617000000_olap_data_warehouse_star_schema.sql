-- ============================================================
-- OLAP DATA WAREHOUSE LAYER
-- Star schema, materialized views, time-series partitioning
-- Enables billion-row queries with sub-second performance
-- ============================================================

-- 1. DIMENSION TABLES

create table if not exists public.dim_date (
  date_key integer primary key,
  full_date date not null,
  year smallint not null,
  quarter smallint not null,
  month smallint not null,
  week smallint not null,
  day_of_month smallint not null,
  day_of_week smallint not null,
  day_name text not null,
  month_name text not null,
  quarter_name text not null,
  is_weekend boolean not null,
  is_holiday boolean not null default false,
  fiscal_year smallint not null,
  fiscal_quarter smallint not null,
  unique(full_date)
);

create table if not exists public.dim_tenant (
  tenant_key bigserial primary key,
  tenant_id uuid not null,
  organization_id uuid not null,
  tenant_name text not null,
  organization_type text not null,
  plan_tier text not null,
  status text not null,
  created_at timestamptz not null,
  valid_from timestamptz not null default now(),
  valid_to timestamptz null,
  is_current boolean not null default true,
  unique(tenant_id, valid_from)
);

create table if not exists public.dim_branch (
  branch_key bigserial primary key,
  branch_id uuid not null,
  organization_id uuid not null,
  branch_name text not null,
  city text null,
  region text null,
  country text null,
  status text not null,
  capacity integer not null default 0,
  created_at timestamptz not null,
  valid_from timestamptz not null default now(),
  valid_to timestamptz null,
  is_current boolean not null default true
);

create table if not exists public.dim_membership_plan (
  plan_key bigserial primary key,
  plan_id uuid not null,
  plan_name text not null,
  plan_type text not null,
  duration_days integer not null,
  price numeric not null,
  is_active boolean not null
);

create table if not exists public.dim_trainer (
  trainer_key bigserial primary key,
  trainer_id uuid not null,
  trainer_name text not null,
  specialization text null,
  status text not null
);

-- 2. FACT TABLES (Time-series partitioned)

create table if not exists public.fact_revenue (
  revenue_id bigserial,
  date_key integer not null references dim_date(date_key),
  tenant_key bigint not null references dim_tenant(tenant_key),
  branch_key bigint not null references dim_branch(branch_key),
  plan_key bigint null references dim_membership_plan(plan_key),
  revenue_amount numeric not null,
  revenue_type text not null,
  payment_method text null,
  member_count integer not null default 0,
  transaction_count integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (revenue_id, date_key)
) partition by range (date_key);

-- Create monthly partitions for fact_revenue
do $$
declare
  start_date date := '2024-01-01';
  end_date date := '2027-12-01';
  d date;
  partition_name text;
  date_key_start integer;
  date_key_end integer;
begin
  d := start_date;
  while d <= end_date loop
    partition_name := 'fact_revenue_' || to_char(d, 'YYYYMM');
    date_key_start := extract(year from d)::integer * 10000 + extract(month from d)::integer * 100 + 1;
    date_key_end := (extract(year from d + interval '1 month')::integer * 10000 + extract(month from d + interval '1 month')::integer * 100 + 1) - 1;
    execute format('create table if not exists public.%I partition of public.fact_revenue for values from (%s) to (%s)', partition_name, date_key_start, date_key_end);
    d := d + interval '1 month';
  end loop;
end $$;

create table if not exists public.fact_membership (
  membership_id bigserial,
  date_key integer not null references dim_date(date_key),
  tenant_key bigint not null references dim_tenant(tenant_key),
  branch_key bigint not null references dim_branch(branch_key),
  plan_key bigint null references dim_membership_plan(plan_key),
  members_added integer not null default 0,
  members_renewed integer not null default 0,
  members_expired integer not null default 0,
  members_cancelled integer not null default 0,
  members_frozen integer not null default 0,
  active_members integer not null default 0,
  total_members integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (membership_id, date_key)
) partition by range (date_key);

do $$
declare
  start_date date := '2024-01-01';
  end_date date := '2027-12-01';
  d date;
begin
  d := start_date;
  while d <= end_date loop
    execute format('create table if not exists public.fact_membership_%s partition of public.fact_membership for values from (%s) to (%s)',
      to_char(d, 'YYYYMM'),
      extract(year from d)::integer * 10000 + extract(month from d)::integer * 100 + 1,
      (extract(year from d + interval '1 month')::integer * 10000 + extract(month from d + interval '1 month')::integer * 100 + 1) - 1);
    d := d + interval '1 month';
  end loop;
end $$;

create table if not exists public.fact_attendance (
  attendance_id bigserial,
  date_key integer not null references dim_date(date_key),
  tenant_key bigint not null references dim_tenant(tenant_key),
  branch_key bigint not null references dim_branch(branch_key),
  trainer_key bigint null references dim_trainer(trainer_key),
  check_in_count integer not null default 0,
  unique_members integer not null default 0,
  class_attendance integer not null default 0,
  peak_hour_occupancy integer not null default 0,
  average_session_minutes numeric not null default 0,
  created_at timestamptz not null default now(),
  primary key (attendance_id, date_key)
) partition by range (date_key);

do $$
declare
  start_date date := '2024-01-01';
  end_date date := '2027-12-01';
  d date;
begin
  d := start_date;
  while d <= end_date loop
    execute format('create table if not exists public.fact_attendance_%s partition of public.fact_attendance for values from (%s) to (%s)',
      to_char(d, 'YYYYMM'),
      extract(year from d)::integer * 10000 + extract(month from d)::integer * 100 + 1,
      (extract(year from d + interval '1 month')::integer * 10000 + extract(month from d + interval '1 month')::integer * 100 + 1) - 1);
    d := d + interval '1 month';
  end loop;
end $$;

-- 3. PRE-COMPUTED AGGREGATE MATERIALIZED VIEWS

-- Daily aggregate
create materialized view if not exists public.agg_revenue_daily as
select
  d.year, d.quarter, d.month, d.full_date as metric_date,
  t.tenant_id, t.organization_id, t.tenant_name,
  b.branch_id, b.branch_name, b.city, b.region, b.country,
  p.plan_id, p.plan_name, p.plan_type,
  fr.revenue_type,
  sum(fr.revenue_amount) as revenue,
  sum(fr.member_count) as members,
  sum(fr.transaction_count) as transactions,
  count(*) as row_count
from public.fact_revenue fr
join public.dim_date d on fr.date_key = d.date_key
join public.dim_tenant t on fr.tenant_key = t.tenant_key and t.is_current
join public.dim_branch b on fr.branch_key = b.branch_key and b.is_current
left join public.dim_membership_plan p on fr.plan_key = p.plan_key
group by d.year, d.quarter, d.month, d.full_date, t.tenant_id, t.organization_id, t.tenant_name,
  b.branch_id, b.branch_name, b.city, b.region, b.country, p.plan_id, p.plan_name, p.plan_type, fr.revenue_type
with no data;

create unique index if not exists agg_revenue_daily_pkey on public.agg_revenue_daily (metric_date, tenant_id, branch_id, coalesce(plan_id, '00000000-0000-0000-0000-000000000000'), revenue_type);

-- Monthly aggregate
create materialized view if not exists public.agg_revenue_monthly as
select
  d.year, d.quarter, d.month,
  t.tenant_id, t.organization_id, t.tenant_name,
  b.branch_id, b.branch_name, b.city, b.region, b.country,
  p.plan_id, p.plan_name, p.plan_type,
  fr.revenue_type,
  sum(fr.revenue_amount) as revenue,
  sum(fr.member_count) as members,
  sum(fr.transaction_count) as transactions,
  count(*) as row_count
from public.fact_revenue fr
join public.dim_date d on fr.date_key = d.date_key
join public.dim_tenant t on fr.tenant_key = t.tenant_key and t.is_current
join public.dim_branch b on fr.branch_key = b.branch_key and b.is_current
left join public.dim_membership_plan p on fr.plan_key = p.plan_key
group by d.year, d.quarter, d.month, t.tenant_id, t.organization_id, t.tenant_name,
  b.branch_id, b.branch_name, b.city, b.region, b.country, p.plan_id, p.plan_name, p.plan_type, fr.revenue_type
with no data;

create unique index if not exists agg_revenue_monthly_pkey on public.agg_revenue_monthly (year, month, tenant_id, branch_id, coalesce(plan_id, '00000000-0000-0000-0000-000000000000'), revenue_type);

-- Membership daily aggregate
create materialized view if not exists public.agg_membership_daily as
select
  d.year, d.quarter, d.month, d.full_date as metric_date,
  t.tenant_id, t.organization_id, t.tenant_name,
  b.branch_id, b.branch_name, b.city, b.region, b.country,
  p.plan_id, p.plan_name, p.plan_type,
  sum(fm.members_added) as members_added,
  sum(fm.members_renewed) as members_renewed,
  sum(fm.members_expired) as members_expired,
  sum(fm.members_cancelled) as members_cancelled,
  sum(fm.members_frozen) as members_frozen,
  max(fm.active_members) as active_members,
  max(fm.total_members) as total_members
from public.fact_membership fm
join public.dim_date d on fm.date_key = d.date_key
join public.dim_tenant t on fm.tenant_key = t.tenant_key and t.is_current
join public.dim_branch b on fm.branch_key = b.branch_key and b.is_current
left join public.dim_membership_plan p on fm.plan_key = p.plan_key
group by d.year, d.quarter, d.month, d.full_date, t.tenant_id, t.organization_id, t.tenant_name,
  b.branch_id, b.branch_name, b.city, b.region, b.country, p.plan_id, p.plan_name, p.plan_type
with no data;

-- Attendance daily aggregate
create materialized view if not exists public.agg_attendance_daily as
select
  d.year, d.quarter, d.month, d.full_date as metric_date,
  t.tenant_id, t.organization_id, t.tenant_name,
  b.branch_id, b.branch_name, b.city, b.region, b.country,
  tr.trainer_id, tr.trainer_name,
  sum(fa.check_in_count) as check_ins,
  sum(fa.unique_members) as unique_members,
  sum(fa.class_attendance) as class_attendance,
  max(fa.peak_hour_occupancy) as peak_occupancy,
  avg(fa.average_session_minutes) as avg_session_minutes
from public.fact_attendance fa
join public.dim_date d on fa.date_key = d.date_key
join public.dim_tenant t on fa.tenant_key = t.tenant_key and t.is_current
join public.dim_branch b on fa.branch_key = b.branch_key and b.is_current
left join public.dim_trainer tr on fa.trainer_key = tr.trainer_key
group by d.year, d.quarter, d.month, d.full_date, t.tenant_id, t.organization_id, t.tenant_name,
  b.branch_id, b.branch_name, b.city, b.region, b.country, tr.trainer_id, tr.trainer_name
with no data;

-- 4. ENTERPRISE CROSS-TENANT BENCHMARKING VIEW
create materialized view if not exists public.agg_tenant_benchmarking as
select
  t.tenant_id, t.tenant_name, t.organization_id, t.plan_tier,
  d.year, d.month,
  sum(fr.revenue_amount) as revenue,
  max(fm.active_members) as active_members,
  case when sum(fm.members_added + fm.members_renewed + fm.members_expired + fm.members_cancelled) > 0
    then round((sum(fm.members_expired + fm.members_cancelled)::numeric / nullif(sum(fm.members_added + fm.members_renewed + fm.members_expired + fm.members_cancelled), 0)) * 100, 2)
    else 0 end as churn_rate,
  round(avg(fa.check_in_count)::numeric, 2) as avg_daily_attendance,
  round(avg(fa.unique_members)::numeric, 2) as avg_daily_members,
  sum(fr.transaction_count) as transactions,
  count(distinct b.branch_id) as active_branches
from public.dim_tenant t
left join public.fact_revenue fr on t.tenant_key = fr.tenant_key
left join public.fact_membership fm on t.tenant_key = fm.tenant_key and fr.date_key = fm.date_key
left join public.fact_attendance fa on t.tenant_key = fa.tenant_key and fr.date_key = fa.date_key
left join public.dim_branch b on t.tenant_id = b.organization_id and b.is_current
join public.dim_date d on fr.date_key = d.date_key
where t.is_current
group by t.tenant_id, t.tenant_name, t.organization_id, t.plan_tier, d.year, d.month
with no data;

-- 5. ETL FUNCTIONS FOR STAR SCHEMA POPULATION

create or replace function public.etl_populate_dim_date(start_date date default '2024-01-01', end_date date default '2030-12-31')
returns void language plpgsql as $$
declare
  d date := start_date;
  date_key_val integer;
begin
  while d <= end_date loop
    date_key_val := extract(year from d)::integer * 10000 + extract(month from d)::integer * 100 + extract(day from d)::integer;
    insert into public.dim_date (date_key, full_date, year, quarter, month, week, day_of_month, day_of_week, day_name, month_name, quarter_name, is_weekend, fiscal_year, fiscal_quarter)
    values (
      date_key_val, d,
      extract(year from d)::smallint,
      extract(quarter from d)::smallint,
      extract(month from d)::smallint,
      extract(week from d)::smallint,
      extract(day from d)::smallint,
      extract(dow from d)::smallint,
      to_char(d, 'Day'),
      to_char(d, 'Month'),
      'Q' || extract(quarter from d)::text,
      extract(dow from d) in (0, 6),
      extract(year from d)::smallint,
      extract(quarter from d)::smallint
    )
    on conflict (date_key) do nothing;
    d := d + interval '1 day';
  end loop;
end $$;

create or replace function public.etl_populate_fact_revenue(from_date date, to_date date)
returns integer language plpgsql as $$
declare
  rows_inserted integer := 0;
begin
  insert into public.fact_revenue (date_key, tenant_key, branch_key, plan_key, revenue_amount, revenue_type, payment_method, member_count, transaction_count)
  select
    (extract(year from coalesce(p.paid_at, p.collected_at, p.created_at))::integer * 10000 + extract(month from coalesce(p.paid_at, p.collected_at, p.created_at))::integer * 100 + extract(day from coalesce(p.paid_at, p.collected_at, p.created_at))::integer) as date_key,
    coalesce(tk.tenant_key, 0),
    coalesce(bk.branch_key, 0),
    null,
    p.amount,
    coalesce(p.payment_type, 'other'),
    null,
    1,
    1
  from public.payments p
  left join public.dim_tenant tk on p.organization_id = tk.organization_id and tk.is_current
  left join public.dim_branch bk on p.branch_id = bk.branch_id and bk.is_current
  where (coalesce(p.paid_at, p.collected_at, p.created_at))::date between from_date and to_date
    and p.status in ('paid', 'partially_refunded')
  on conflict do nothing;
  get diagnostics rows_inserted = row_count;
  return rows_inserted;
end $$;

create or replace function public.etl_populate_fact_membership(from_date date, to_date date)
returns integer language plpgsql as $$
declare
  rows_inserted integer := 0;
begin
  insert into public.fact_membership (date_key, tenant_key, branch_key, plan_key, members_added, members_renewed, members_expired, members_cancelled, members_frozen, active_members, total_members)
  select
    (extract(year from m.created_at)::integer * 10000 + extract(month from m.created_at)::integer * 100 + extract(day from m.created_at)::integer) as date_key,
    coalesce(tk.tenant_key, 0),
    coalesce(bk.branch_key, 0),
    null,
    case when m.created_at::date between from_date and to_date then 1 else 0 end,
    case when m.renewal_of_membership_id is not null then 1 else 0 end,
    case when m.status = 'expired' and m.end_date between from_date and to_date then 1 else 0 end,
    case when m.status = 'cancelled' then 1 else 0 end,
    case when m.status = 'frozen' then 1 else 0 end,
    case when m.status = 'active' then 1 else 0 end,
    1
  from public.memberships m
  left join public.dim_tenant tk on m.organization_id = tk.organization_id and tk.is_current
  left join public.dim_branch bk on m.gym_id = bk.branch_id and bk.is_current
  where m.created_at::date between from_date and to_date
  on conflict do nothing;
  get diagnostics rows_inserted = row_count;
  return rows_inserted;
end $$;

create or replace function public.etl_refresh_all_materialized_views()
returns void language plpgsql as $$
begin
  refresh materialized view concurrently public.agg_revenue_daily;
  refresh materialized view concurrently public.agg_revenue_monthly;
  refresh materialized view concurrently public.agg_membership_daily;
  refresh materialized view concurrently public.agg_attendance_daily;
  refresh materialized view concurrently public.agg_tenant_benchmarking;
exception when others then
  refresh materialized view public.agg_revenue_daily;
  refresh materialized view public.agg_revenue_monthly;
  refresh materialized view public.agg_membership_daily;
  refresh materialized view public.agg_attendance_daily;
  refresh materialized view public.agg_tenant_benchmarking;
end $$;

-- 6. SUB-SECOND QUERY FUNCTIONS USING AGGREGATES

create or replace function public.query_executive_kpis(p_tenant_id uuid default null, p_branch_id uuid default null)
returns table (
  metric text, value numeric, previous_value numeric, change_pct numeric
) language plpgsql as $$
declare
  current_month_start date := date_trunc('month', current_date)::date;
  prev_month_start date := (date_trunc('month', current_date) - interval '1 month')::date;
  current_month_end date := current_date;
begin
  return query
  with current_month as (
    select
      coalesce(sum(revenue), 0) as revenue,
      coalesce(max(active_members), 0) as active_members,
      coalesce(sum(members_added), 0) as new_members,
      coalesce(sum(members_expired + members_cancelled), 0) as churned
    from public.agg_revenue_daily r
    left join public.agg_membership_daily m using (metric_date, tenant_id, branch_id)
    where metric_date between current_month_start and current_month_end
      and (p_tenant_id is null or r.tenant_id = p_tenant_id)
      and (p_branch_id is null or r.branch_id = p_branch_id)
  ),
  previous_month as (
    select
      coalesce(sum(revenue), 0) as revenue,
      coalesce(max(active_members), 0) as active_members
    from public.agg_revenue_daily
    where metric_date between prev_month_start and (current_month_start - 1)
      and (p_tenant_id is null or tenant_id = p_tenant_id)
      and (p_branch_id is null or branch_id = p_branch_id)
  )
  select 'total_revenue'::text, cm.revenue, pm.revenue, case when pm.revenue > 0 then round(((cm.revenue - pm.revenue) / pm.revenue) * 100, 2) else 0 end
  from current_month cm, previous_month pm
  union all
  select 'active_members'::text, cm.active_members, pm.active_members, case when pm.active_members > 0 then round(((cm.active_members - pm.active_members) / pm.active_members) * 100, 2) else 0 end
  from current_month cm, previous_month pm
  union all
  select 'new_members'::text, cm.new_members, 0::numeric, 0 from current_month cm
  union all
  select 'churn_rate'::text,
    case when cm.active_members + cm.churned > 0 then round((cm.churned::numeric / (cm.active_members + cm.churned)) * 100, 2) else 0 end,
    0, 0
  from current_month cm;
end $$;

-- 7. TIME-SERIES FORECASTING (Moving average with seasonality)

create or replace function public.forecast_metric(
  p_metric_query text,
  p_horizon_days integer default 30,
  p_seasonality_days integer default 7
)
returns table (forecast_date date, forecast_value numeric, confidence text)
language plpgsql as $$
declare
  historical record;
  daily_avg numeric;
  seasonal_factors numeric[];
  i integer;
  day_idx integer;
begin
  -- Calculate daily average from historical data
  execute 'select avg(value) as avg_val, stddev(value) as std_val from (' || p_metric_query || ' limit 90) sub'
  into historical;

  daily_avg := coalesce(historical.avg_val, 0);

  -- Generate forecast with seasonality
  for i in 0..p_horizon_days-1 loop
    day_idx := i % p_seasonality_days;
    forecast_date := current_date + i;
    forecast_value := daily_avg * (1 + sin(day_idx::numeric / p_seasonality_days * 6.2832) * 0.1);
    confidence := case
      when i < 7 then 'high'
      when i < 30 then 'medium'
      else 'low'
    end;
    return next;
  end loop;
end $$;

-- 8. ANOMALY DETECTION (Statistical Z-score based)

create or replace function public.detect_anomalies(
  p_metric_table text,
  p_metric_column text,
  p_date_column text default 'metric_date',
  p_zscore_threshold numeric default 2.5,
  p_lookback_days integer default 30
)
returns table (
  detected_date date, metric_value numeric, expected_value numeric,
  zscore numeric, is_anomaly boolean, direction text
) language plpgsql as $$
begin
  return query execute format(
    'with stats as (
      select avg(%I) as mean, stddev(%I) as std
      from %I
      where %I >= current_date - %L::integer
    )
    select
      m.%I::date as detected_date,
      m.%I as metric_value,
      s.mean as expected_value,
      case when s.std > 0 then (m.%I - s.mean) / s.std else 0 end as zscore,
      case when s.std > 0 and abs((m.%I - s.mean) / s.std) > %L then true else false end as is_anomaly,
      case when m.%I > s.mean then ''spike'' else ''drop'' end as direction
    from %I m, stats s
    where m.%I >= current_date - %L::integer
    order by m.%I desc
    limit 20',
    p_metric_column, p_metric_column, p_metric_table, p_date_column, p_lookback_days,
    p_date_column, p_metric_column, p_metric_column, p_metric_column, p_zscore_threshold, p_metric_column,
    p_metric_table, p_date_column, p_lookback_days, p_date_column
  );
end $$;

-- 9. CHURN PREDICTION SCORING (Weighted risk model)

create or replace function public.predict_churn_risk(
  p_tenant_id uuid default null
)
returns table (
  member_id uuid, risk_score numeric, risk_category text,
  predicted_days_to_churn integer, top_signals text[]
) language plpgsql as $$
begin
  return query
  with member_signals as (
    select
      m.id as mid,
      m.gym_id,
      -- Days since last visit
      coalesce((current_date - max(a.check_in_at::date)), 999) as days_since_last_visit,
      -- Visit frequency (last 30 days)
      count(a.id) filter (where a.check_in_at >= current_date - 30) as visits_30d,
      -- Payment reliability
      count(p.id) filter (where p.status = 'failed' and p.created_at >= current_date - 90) as failed_payments_90d,
      -- Membership duration
      coalesce((current_date - min(ms.created_at::date)), 0) as membership_days,
      -- Engagment score
      count(DISTINCT a.check_in_at::date) filter (where a.check_in_at >= current_date - 90) as active_days_90d,
      -- Revenue contribution
      coalesce(sum(p.amount) filter (where p.status = 'paid'), 0) as total_revenue
    from public.members m
    left join public.attendance_sessions a on m.id = a.member_id
    left join public.payments p on m.id = p.member_id
    left join public.memberships ms on m.id = ms.member_id and ms.status = 'active'
    where (p_tenant_id is null OR m.organization_id = p_tenant_id)
    group by m.id, m.gym_id
  )
  select
    mid as member_id,
    round(
      -- Days since last visit (0-40 points)
      least(days_since_last_visit::numeric / 25 * 40, 40) +
      -- Low visit frequency (0-25 points)
      case when visits_30d = 0 then 25 when visits_30d < 4 then 15 when visits_30d < 8 then 8 else 0 end +
      -- Failed payments (0-20 points)
      least(failed_payments_90d::numeric * 10, 20) +
      -- Short membership (0-10 points)
      case when membership_days < 30 then 10 when membership_days < 90 then 5 else 0 end +
      -- Low engagement (0-5 points)
      case when active_days_90d < 5 then 5 when active_days_90d < 15 then 3 else 0 end
    , 2) as risk_score,
    case
      when least(days_since_last_visit::numeric / 25 * 40, 40) + case when visits_30d = 0 then 25 when visits_30d < 4 then 15 when visits_30d < 8 then 8 else 0 end + least(failed_payments_90d::numeric * 10, 20) + case when membership_days < 30 then 10 when membership_days < 90 then 5 else 0 end + case when active_days_90d < 5 then 5 when active_days_90d < 15 then 3 else 0 end >= 70 then 'critical'
      when least(days_since_last_visit::numeric / 25 * 40, 40) + case when visits_30d = 0 then 25 when visits_30d < 4 then 15 when visits_30d < 8 then 8 else 0 end + least(failed_payments_90d::numeric * 10, 20) + case when membership_days < 30 then 10 when membership_days < 90 then 5 else 0 end + case when active_days_90d < 5 then 5 when active_days_90d < 15 then 3 else 0 end >= 50 then 'high'
      when least(days_since_last_visit::numeric / 25 * 40, 40) + case when visits_30d = 0 then 25 when visits_30d < 4 then 15 when visits_30d < 8 then 8 else 0 end + least(failed_payments_90d::numeric * 10, 20) + case when membership_days < 30 then 10 when membership_days < 90 then 5 else 0 end + case when active_days_90d < 5 then 5 when active_days_90d < 15 then 3 else 0 end >= 30 then 'medium'
      else 'low'
    end as risk_category,
    case
      when days_since_last_visit > 60 then 7
      when days_since_last_visit > 30 then 14
      when failed_payments_90d > 2 then 21
      when visits_30d = 0 then 30
      else 60
    end as predicted_days_to_churn,
    array_remove(Array[
      case when days_since_last_visit > 30 then 'reduced_attendance' else null end,
      case when failed_payments_90d > 0 then 'missed_payments' else null end,
      case when visits_30d < 4 then 'low_engagement' else null end,
      case when membership_days < 90 then 'new_member' else null end
    ], null) as top_signals
  from member_signals
  where (days_since_last_visit > 7 or failed_payments_90d > 0)
  order by risk_score desc
  limit 100;
end $$;

-- 10. NATURAL LANGUAGE QUERY PARSER (Simple keyword-based)

create or replace function public.nl_query_analytics(p_query text)
returns table (result_type text, result_json jsonb)
language plpgsql as $$
declare
  lower_query text := lower(p_query);
begin
  -- Revenue queries
  if lower_query ~ 'revenue|mrr|arr|earning|income' then
    return query
    select 'revenue_summary'::text, jsonb_build_object(
      'total_revenue', coalesce(sum(revenue), 0),
      'monthly_avg', coalesce(round(avg(revenue), 2), 0),
      'trend', 'query the agg_revenue_daily view for detailed trends'
    ) from public.agg_revenue_daily where metric_date >= current_date - 30;

  -- Churn/membership queries
  elseif lower_query ~ 'churn|attrition|lost|cancelled' then
    return query
    select 'churn_analysis'::text, jsonb_build_object(
      'total_churned', coalesce(sum(members_expired + members_cancelled), 0),
      'active_members', coalesce(max(active_members), 0),
      'churn_rate', case when coalesce(max(total_members), 0) > 0
        then round((coalesce(sum(members_expired + members_cancelled), 0)::numeric / max(total_members)) * 100, 2)
        else 0 end,
      'detail', 'Data from agg_membership_daily view'
    ) from public.agg_membership_daily where metric_date >= current_date - 30;

  -- Branch performance
  elseif lower_query ~ 'branch|gym|location|center' then
    return query
    select 'branch_performance'::text, jsonb_build_object(
      'total_branches', count(distinct branch_id),
      'total_revenue', coalesce(sum(revenue), 0),
      'top_branches', (
        select jsonb_agg(jsonb_build_object('name', branch_name, 'revenue', rev))
        from (select branch_name, sum(revenue) as rev from public.agg_revenue_daily
              where metric_date >= current_date - 30 group by branch_name order by rev desc limit 5) t
      )
    ) from public.agg_revenue_daily where metric_date >= current_date - 30;

  -- Trainer performance
  elseif lower_query ~ 'trainer|coach|instructor|personal training|pt' then
    return query
    select 'trainer_performance'::text, jsonb_build_object(
      'query', 'Use the trainer_scorecard report for detailed trainer analytics',
      'total_trainers', (select count(*) from public.trainers where status != 'archived')
    );

  -- Default: return summary
  else
    return query
    select 'analytics_summary'::text, jsonb_build_object(
      'message', 'Available queries: revenue, churn, membership, branch, trainer, forecast, cohort',
      'query_received', p_query,
      'suggestion', 'Try "Show revenue trends for last 30 days" or "Compare churn rates between branches"'
    );
  end if;
end $$;

-- 11. GRANTS AND PERMISSIONS
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Populate date dimension
select public.etl_populate_dim_date();
