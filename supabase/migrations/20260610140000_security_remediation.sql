-- QA Phase 3.5 security remediation.
-- Scope: least-privilege RLS, invoker-secured views, and payment idempotency guards.

create or replace function public.can_operate_gym(target_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or (
      target_gym_id is not null
      and target_gym_id = public.current_user_gym_id()
      and public.has_any_role(array['gym_admin', 'reception_staff'])
    )
    or exists (
      select 1
      from public.branches b
      join public.branch_users bu on bu.branch_id = b.id
      where b.gym_id = target_gym_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
        and bu.branch_role in ('owner', 'admin', 'manager', 'staff')
    );
$$;

create or replace function public.can_manage_gym(target_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or (
      target_gym_id is not null
      and target_gym_id = public.current_user_gym_id()
      and public.has_any_role(array['gym_admin'])
    )
    or exists (
      select 1
      from public.branches b
      join public.branch_users bu on bu.branch_id = b.id
      where b.gym_id = target_gym_id
        and bu.user_id = (select auth.uid())
        and bu.status = 'active'
        and bu.branch_role in ('owner', 'admin', 'manager')
    );
$$;

grant execute on function public.can_operate_gym(uuid) to authenticated;
grant execute on function public.can_manage_gym(uuid) to authenticated;

-- Recreate aggregate views as invoker-secured views so underlying RLS remains effective.
create or replace view public.membership_expiry_summary
with (security_invoker = true) as
select
  memberships.gym_id,
  count(*) filter (where memberships.status = 'active') as active_memberships,
  count(*) filter (where memberships.status = 'expired') as expired_memberships,
  count(*) filter (where memberships.status = 'active' and memberships.end_date = current_date) as expiring_today,
  count(*) filter (where memberships.status = 'active' and memberships.end_date between current_date and current_date + interval '7 days') as expiring_this_week,
  count(*) filter (where memberships.status = 'active' and memberships.end_date between current_date and current_date + interval '30 days') as expiring_this_month,
  count(*) filter (where memberships.created_at >= date_trunc('month', now())) as new_memberships_this_month
from public.memberships
group by memberships.gym_id;

create or replace view public.membership_revenue_summary
with (security_invoker = true) as
select
  memberships.gym_id,
  date_trunc('month', memberships.created_at)::date as month,
  count(*) as membership_count,
  sum(memberships.total_amount) as total_amount
from public.memberships
where memberships.payment_status in ('paid', 'waived')
group by memberships.gym_id, date_trunc('month', memberships.created_at)::date;

create or replace view public.revenue_daily_summary
with (security_invoker = true) as
select
  gym_id,
  date_trunc('day', paid_at)::date as revenue_date,
  sum(amount) filter (where status in ('paid', 'partially_refunded')) as gross_revenue,
  sum(coalesce(discount_amount, 0)) as discounts,
  count(*) as payment_count
from public.payments
where paid_at is not null
group by gym_id, date_trunc('day', paid_at)::date;

create or replace view public.payment_method_breakdown
with (security_invoker = true) as
select
  gym_id,
  method,
  count(*) as payment_count,
  sum(amount) as total_amount
from public.payments
where status in ('paid', 'partially_refunded')
group by gym_id, method;

create or replace view public.enterprise_branch_metrics_latest
with (security_invoker = true) as
select distinct on (b.id)
  b.organization_id,
  b.id as branch_id,
  b.name as branch_name,
  b.status as branch_status,
  b.city,
  b.capacity,
  bm.metric_date,
  coalesce(bm.revenue_amount, 0) as revenue_amount,
  coalesce(bm.active_members, 0) as active_members,
  coalesce(bm.attendance_count, 0) as attendance_count,
  coalesce(bm.trainer_utilization, 0) as trainer_utilization,
  coalesce(bm.class_utilization, 0) as class_utilization,
  coalesce(bm.storage_mb, 0) as storage_mb,
  coalesce(bm.api_requests, 0) as api_requests
from public.branches b
left join public.branch_metrics bm on bm.branch_id = b.id
order by b.id, bm.metric_date desc nulls last;

create or replace view public.enterprise_tenant_usage_summary
with (security_invoker = true) as
select
  o.id as organization_id,
  o.name as organization_name,
  o.organization_type,
  o.status as organization_status,
  tc.plan_tier,
  tc.custom_domain,
  tc.subdomain,
  ps.branch_limit,
  ps.member_limit,
  ps.storage_limit_mb,
  count(distinct b.id) as branches,
  count(distinct bu.user_id) as users,
  coalesce(sum(ebm.active_members), 0)::bigint as active_members,
  coalesce(sum(ebm.revenue_amount), 0)::numeric(14, 2) as revenue_amount,
  coalesce(sum(ebm.storage_mb), 0)::numeric(12, 2) as storage_mb
from public.organizations o
left join public.tenant_configs tc on tc.organization_id = o.id
left join public.platform_subscriptions ps on ps.organization_id = o.id
left join public.branches b on b.organization_id = o.id and b.status <> 'archived'
left join public.branch_users bu on bu.organization_id = o.id and bu.status = 'active'
left join public.enterprise_branch_metrics_latest ebm on ebm.branch_id = b.id
group by o.id, o.name, o.organization_type, o.status, tc.plan_tier, tc.custom_domain, tc.subdomain, ps.branch_limit, ps.member_limit, ps.storage_limit_mb;

create or replace view public.enterprise_security_summary
with (security_invoker = true) as
select
  organization_id,
  status,
  severity,
  count(*)::bigint as event_count,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from public.security_events
group by organization_id, status, severity;

create or replace view public.pwa_mobile_engagement_summary
with (security_invoker = true) as
select
  coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid) as organization_id,
  count(*) filter (where event_type = 'standalone_open') as standalone_opens,
  count(*) filter (where event_type = 'install_prompt_shown') as install_prompts,
  count(*) filter (where event_type = 'install_accepted') as installs,
  count(*) filter (where event_type = 'push_opt_in') as push_opt_ins,
  count(*) filter (where event_type = 'offline_action_queued') as offline_actions_queued,
  max(occurred_at) as latest_event_at
from public.pwa_install_events
group by coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid);

create or replace view public.ai_member_risk_summary
with (security_invoker = true) as
select
  m.gym_id,
  m.id as member_id,
  m.full_name,
  m.member_code,
  fp.engagement_score,
  fp.churn_risk_score,
  fp.churn_risk_category,
  fp.primary_goal,
  fp.generated_at
from public.members m
left join lateral (
  select *
  from public.ai_fitness_profiles fp
  where fp.member_id = m.id
  order by fp.generated_at desc
  limit 1
) fp on true;

create or replace view public.ai_operational_summary
with (security_invoker = true) as
select
  gym_id,
  count(*) filter (where status in ('draft', 'pending_review')) as pending_review_items,
  count(*) filter (where status = 'approved') as approved_items,
  count(*) filter (where recommendation_type = 'retention') as retention_recommendations,
  avg(confidence) as average_confidence,
  max(created_at) as latest_recommendation_at
from public.ai_recommendations
group by gym_id;

-- AI RLS: replace tenant-wide management policies with role/ownership-specific policies.
drop policy if exists "ai member profile visibility" on public.ai_fitness_profiles;
drop policy if exists "ai staff profile management" on public.ai_fitness_profiles;
create policy "ai profiles visible by owner trainer or staff"
on public.ai_fitness_profiles for select to authenticated
using (
  exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.can_operate_gym(gym_id)
);
create policy "ai profiles insertable by owner trainer or staff"
on public.ai_fitness_profiles for insert to authenticated
with check (
  exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.can_operate_gym(gym_id)
);
create policy "ai profiles updateable by trainer or staff"
on public.ai_fitness_profiles for update to authenticated
using (public.is_trainer_for_member(member_id) or public.can_operate_gym(gym_id))
with check (public.is_trainer_for_member(member_id) or public.can_operate_gym(gym_id));

drop policy if exists "ai recommendation visibility" on public.ai_recommendations;
drop policy if exists "ai staff recommendation management" on public.ai_recommendations;
create policy "ai recommendations visible by owner trainer or staff"
on public.ai_recommendations for select to authenticated
using (
  exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or (member_id is not null and public.is_trainer_for_member(member_id))
  or public.can_operate_gym(gym_id)
);
create policy "ai recommendations insertable by owner trainer or staff"
on public.ai_recommendations for insert to authenticated
with check (
  exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or (member_id is not null and public.is_trainer_for_member(member_id))
  or public.can_operate_gym(gym_id)
);
create policy "ai recommendations reviewable by trainer or staff"
on public.ai_recommendations for update to authenticated
using ((member_id is not null and public.is_trainer_for_member(member_id)) or public.can_operate_gym(gym_id))
with check ((member_id is not null and public.is_trainer_for_member(member_id)) or public.can_operate_gym(gym_id));
create policy "ai recommendations deletable by gym managers"
on public.ai_recommendations for delete to authenticated
using (public.can_manage_gym(gym_id));

drop policy if exists "ai chat session owner visibility" on public.ai_chat_sessions;
drop policy if exists "ai chat messages follow session" on public.ai_chat_messages;
create policy "ai chat sessions owned by user"
on public.ai_chat_sessions for all to authenticated
using (user_id = (select auth.uid()) or public.is_super_admin())
with check (user_id = (select auth.uid()) or public.is_super_admin());
create policy "ai chat messages owned by session user"
on public.ai_chat_messages for all to authenticated
using (
  exists (
    select 1 from public.ai_chat_sessions s
    where s.id = session_id
      and (s.user_id = (select auth.uid()) or public.is_super_admin())
  )
)
with check (
  exists (
    select 1 from public.ai_chat_sessions s
    where s.id = session_id
      and (s.user_id = (select auth.uid()) or public.is_super_admin())
  )
);

drop policy if exists "staff manage ai operational data" on public.ai_knowledge_documents;
drop policy if exists "staff manage ai chunks" on public.ai_knowledge_chunks;
create policy "ai knowledge visible in tenant scope"
on public.ai_knowledge_documents for select to authenticated
using (gym_id is null or public.can_operate_gym(gym_id) or public.can_access_gym(gym_id));
create policy "ai knowledge manageable by gym managers"
on public.ai_knowledge_documents for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
create policy "ai knowledge chunks visible in tenant scope"
on public.ai_knowledge_chunks for select to authenticated
using (gym_id is null or public.can_operate_gym(gym_id) or public.can_access_gym(gym_id));
create policy "ai knowledge chunks manageable by gym managers"
on public.ai_knowledge_chunks for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));

create policy "ai generated programs visible by owner trainer or staff"
on public.ai_generated_programs for select to authenticated
using (
  exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
  or public.can_operate_gym(gym_id)
);
create policy "ai generated programs insertable by trainer or staff"
on public.ai_generated_programs for insert to authenticated
with check (public.is_trainer_for_member(member_id) or public.can_operate_gym(gym_id));
create policy "ai generated programs updateable by trainer or staff"
on public.ai_generated_programs for update to authenticated
using (public.is_trainer_for_member(member_id) or public.can_operate_gym(gym_id))
with check (public.is_trainer_for_member(member_id) or public.can_operate_gym(gym_id));
create policy "ai generated programs deletable by gym managers"
on public.ai_generated_programs for delete to authenticated
using (public.can_manage_gym(gym_id));

drop policy if exists "staff read ai predictions forecasts insights" on public.ai_predictions;
drop policy if exists "staff manage ai predictions" on public.ai_predictions;
drop policy if exists "staff manage ai forecasts" on public.ai_forecasts;
drop policy if exists "staff manage ai insights" on public.ai_insights;
drop policy if exists "staff manage ai content drafts" on public.ai_content_drafts;
drop policy if exists "staff manage ai automation suggestions" on public.ai_automation_suggestions;
drop policy if exists "staff read ai observability" on public.ai_observability_logs;
create policy "ai predictions visible by owner trainer or staff"
on public.ai_predictions for select to authenticated
using (
  exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or (member_id is not null and public.is_trainer_for_member(member_id))
  or public.can_operate_gym(gym_id)
);
create policy "ai predictions manageable by gym managers"
on public.ai_predictions for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
create policy "ai forecasts visible by tenant staff"
on public.ai_forecasts for select to authenticated
using (public.can_operate_gym(gym_id));
create policy "ai forecasts manageable by gym managers"
on public.ai_forecasts for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
create policy "ai insights visible by tenant staff"
on public.ai_insights for select to authenticated
using (public.can_operate_gym(gym_id));
create policy "ai insights manageable by gym managers"
on public.ai_insights for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
create policy "ai content drafts visible by tenant staff"
on public.ai_content_drafts for select to authenticated
using (public.can_operate_gym(gym_id));
create policy "ai content drafts manageable by gym managers"
on public.ai_content_drafts for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
create policy "ai automation suggestions visible by tenant staff"
on public.ai_automation_suggestions for select to authenticated
using (public.can_operate_gym(gym_id));
create policy "ai automation suggestions manageable by gym managers"
on public.ai_automation_suggestions for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
create policy "ai observability visible by owner or tenant staff"
on public.ai_observability_logs for select to authenticated
using (user_id = (select auth.uid()) or public.can_operate_gym(gym_id));

-- Communication management RLS now matches server-side manager roles.
drop policy if exists "staff can manage communication templates" on public.notification_templates;
create policy "managers can manage communication templates"
on public.notification_templates for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
drop policy if exists "staff can manage segments" on public.communication_segments;
create policy "managers can manage communication segments"
on public.communication_segments for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
drop policy if exists "staff can manage announcements" on public.announcements;
create policy "managers can manage announcements"
on public.announcements for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
drop policy if exists "staff can manage campaigns" on public.campaigns;
create policy "managers can manage campaigns"
on public.campaigns for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
drop policy if exists "staff can manage campaign recipients" on public.campaign_recipients;
create policy "managers can manage campaign recipients"
on public.campaign_recipients for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
drop policy if exists "staff can manage automation rules" on public.communication_automation_rules;
create policy "managers can manage automation rules"
on public.communication_automation_rules for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));

-- Financial records are created through server-side workflows. Direct table writes are manager-only.
drop policy if exists "staff can manage discounts" on public.discounts;
create policy "managers can manage discounts"
on public.discounts for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
drop policy if exists "staff can manage coupons" on public.coupons;
create policy "managers can manage coupons"
on public.coupons for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
drop policy if exists "staff can write invoices" on public.invoices;
create policy "managers can write invoices"
on public.invoices for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
drop policy if exists "staff can insert invoice items" on public.invoice_items;
create policy "managers can insert invoice items"
on public.invoice_items for insert to authenticated
with check (
  exists (
    select 1 from public.invoices
    where invoices.id = invoice_items.invoice_id
      and public.can_manage_gym(invoices.gym_id)
  )
);
drop policy if exists "staff can write payments" on public.payments;
create policy "managers can write payments"
on public.payments for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
drop policy if exists "staff can manage payment attempts" on public.payment_attempts;
create policy "managers can manage payment attempts"
on public.payment_attempts for all to authenticated
using (public.can_manage_gym(gym_id))
with check (public.can_manage_gym(gym_id));
drop policy if exists "staff can insert transactions" on public.transactions;
create policy "managers can insert transactions"
on public.transactions for insert to authenticated
with check (public.can_manage_gym(gym_id));
drop policy if exists "staff can insert billing events" on public.billing_events;
create policy "managers can insert billing events"
on public.billing_events for insert to authenticated
with check (public.can_manage_gym(gym_id));

create unique index if not exists transactions_one_payment_collected_idx
on public.transactions (payment_id)
where payment_id is not null and transaction_type = 'payment_collected';

create unique index if not exists refunds_provider_refund_id_idx
on public.refunds (provider_refund_id)
where provider_refund_id is not null;

-- Members may read their own QR for display, but token writes are trusted server/staff operations only.
drop policy if exists "qr tokens manageable by owner or staff" on public.qr_tokens;
drop policy if exists "qr tokens manageable by operations staff" on public.qr_tokens;
create policy "qr tokens manageable by operations staff"
on public.qr_tokens for all to authenticated
using (public.can_operate_gym(gym_id))
with check (public.can_operate_gym(gym_id));
