-- ============================================================
-- COMPLIANCE, GOVERNANCE & DATA MASKING
-- GDPR, SOC 2, ISO 27001 ready
-- ============================================================

-- 1. DATA MASKING FUNCTIONS (PII protection)
create or replace function public.mask_email(email text)
returns text language sql immutable as $$
  select case when email is null then null
    else regexp_replace(email, '(.).*@', '\1***@')
  end;
$$;

create or replace function public.mask_phone(phone text)
returns text language sql immutable as $$
  select case when phone is null then null
    else regexp_replace(phone, '.(?=.{4})', '*', 'g')
  end;
$$;

create or replace function public.mask_name(name text)
returns text language sql immutable as $$
  select case when name is null then null
    else regexp_replace(name, '(.).*', '\1***')
  end;
$$;

-- 2. AUDIT TRAIL ENHANCEMENTS
create table if not exists public.analytics_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text null,
  old_values jsonb null,
  new_values jsonb null,
  ip_address inet null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_audit_actor_idx on public.analytics_audit_log (actor_id, created_at desc);
create index if not exists analytics_audit_action_idx on public.analytics_audit_log (action, created_at desc);
create index if not exists analytics_audit_entity_idx on public.analytics_audit_log (entity_type, entity_id);

comment on table public.analytics_audit_log is 'Immutable audit trail for all analytics operations (GDPR/SOC 2)';

-- 3. DATA RETENTION POLICIES
create table if not exists public.analytics_retention_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  table_name text not null,
  retention_days integer not null default 365,
  action text not null default 'delete' check (action in ('delete', 'anonymize', 'archive')),
  is_active boolean not null default true,
  last_enforced_at timestamptz null,
  created_at timestamptz not null default now()
);

comment on table public.analytics_retention_policies is 'Automated data retention schedules for GDPR compliance';

-- 4. GDPR DATA EXPORT FUNCTION
create or replace function public.export_member_data(p_member_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'member', row_to_json(m),
    'memberships', (select jsonb_agg(row_to_json(ms)) from public.memberships ms where ms.member_id = p_member_id),
    'payments', (select jsonb_agg(row_to_json(p)) from public.payments p where p.member_id = p_member_id),
    'attendance', (select jsonb_agg(row_to_json(a)) from public.attendance_sessions a where a.member_id = p_member_id),
    'fitness_goals', (select jsonb_agg(row_to_json(fg)) from public.fitness_goals fg where fg.member_id = p_member_id),
    'workouts', (select jsonb_agg(row_to_json(w)) from public.workout_sessions w where w.member_id = p_member_id)
  ) into result
  from public.members m where m.id = p_member_id;

  return result;
end $$;

-- 5. DATA DELETION FUNCTION (Right to be Forgotten)
create or replace function public.anonymize_member_data(p_member_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.members set
    email = public.mask_email(email),
    phone = public.mask_phone(phone),
    full_name = public.mask_name(full_name),
    metadata = jsonb_set(metadata, '{anonymized_at}', to_jsonb(now()), true)
  where id = p_member_id;

  update auth.users set
    email = public.mask_email(email),
    raw_user_meta_data = jsonb_set(raw_user_meta_data, '{anonymized}', 'true', true),
    phone = null
  where id = p_member_id;

  insert into public.analytics_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (null, 'member_anonymized', 'member', p_member_id::text,
    jsonb_build_object('anonymized_at', now()));
end $$;

-- 6. SENSITIVE DATA ACCESS VIEW (masks PII for non-privileged roles)
create or replace view public.members_secure with (security_invoker = true) as
select
  id, gym_id, organization_id,
  case when public.is_super_admin() then email else public.mask_email(email) end as email,
  case when public.is_super_admin() then phone else public.mask_phone(phone) end as phone,
  case when public.is_super_admin() then full_name else public.mask_name(full_name) end as full_name,
  status,
  membership_type,
  created_at
from public.members;

-- 7. COMPLIANCE REPORT GENERATION
create or replace function public.generate_compliance_report(
  p_organization_id uuid default null,
  p_report_type text default 'gdpr'
)
returns jsonb language plpgsql as $$
declare
  report jsonb;
begin
  if p_report_type = 'gdpr' then
    select jsonb_build_object(
      'report_type', 'GDPR Compliance Report',
      'generated_at', now(),
      'organization_id', p_organization_id,
      'total_members', (select count(*) from public.members where organization_id = p_organization_id or p_organization_id is null),
      'data_subject_requests', (select count(*) from public.compliance_requests where organization_id = p_organization_id or p_organization_id is null),
      'data_retention_policies', (select count(*) from public.analytics_retention_policies where organization_id = p_organization_id or p_organization_id is null),
      'anonymized_members', (select count(*) from public.members where metadata->>'anonymized_at' is not null),
      'audit_events', (select count(*) from public.analytics_audit_log where created_at >= current_date - 90)
    ) into report;
  elsif p_report_type = 'soc2' then
    select jsonb_build_object(
      'report_type', 'SOC 2 Compliance Report',
      'generated_at', now(),
      'access_reviews', (select count(*) from public.audit_logs where action like '%role%' and created_at >= current_date - 90),
      'security_events', (select count(*) from public.security_events where created_at >= current_date - 90),
      'mfa_enforcement', (select count(*) from public.mfa_policies where is_active = true)
    ) into report;
  end if;

  return report;
end $$;

-- 8. GRANTS
grant select on public.members_secure to authenticated;
grant execute on function public.mask_email to authenticated;
grant execute on function public.mask_phone to authenticated;
grant execute on function public.mask_name to authenticated;
grant execute on function public.export_member_data to authenticated;
grant execute on function public.generate_compliance_report to authenticated;
