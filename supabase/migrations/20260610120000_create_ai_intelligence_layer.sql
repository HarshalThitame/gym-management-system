create extension if not exists vector with schema extensions;

create table if not exists public.ai_fitness_profiles (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  member_id uuid not null references public.members(id) on delete cascade,
  profile_version integer not null default 1,
  fitness_level text not null default 'beginner' check (fitness_level in ('beginner', 'intermediate', 'advanced', 'athlete')),
  primary_goal text,
  engagement_score numeric(5,2) not null default 0 check (engagement_score >= 0 and engagement_score <= 100),
  churn_risk_score numeric(5,2) not null default 0 check (churn_risk_score >= 0 and churn_risk_score <= 100),
  churn_risk_category text not null default 'low' check (churn_risk_category in ('low', 'medium', 'high', 'critical')),
  context_summary text not null,
  signals jsonb not null default '{}'::jsonb,
  generated_by text not null default 'rules_engine' check (generated_by in ('rules_engine', 'openai', 'hybrid')),
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, profile_version)
);

create table if not exists public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  member_id uuid references public.members(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete set null,
  recommendation_type text not null check (recommendation_type in ('workout', 'nutrition', 'class', 'trainer_match', 'retention', 'automation', 'content', 'executive')),
  title text not null,
  summary text not null,
  explanation text not null,
  confidence numeric(5,2) not null default 0 check (confidence >= 0 and confidence <= 100),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'rejected', 'applied', 'archived')),
  human_review_required boolean not null default true,
  evidence jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_generated_programs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  member_id uuid references public.members(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete set null,
  name text not null,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  goal text not null,
  duration_weeks integer not null check (duration_weeks between 1 and 52),
  program_json jsonb not null default '{}'::jsonb,
  recovery_guidance text,
  safety_notes text,
  status text not null default 'pending_review' check (status in ('draft', 'pending_review', 'approved', 'rejected', 'converted', 'archived')),
  generated_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  member_id uuid references public.members(id) on delete cascade,
  trainer_id uuid references public.trainers(id) on delete set null,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null default 'AI coach session',
  status text not null default 'active' check (status in ('active', 'archived', 'flagged')),
  safety_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  safety_flags jsonb not null default '[]'::jsonb,
  token_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  source_type text not null check (source_type in ('policy', 'workout_library', 'nutrition_library', 'trainer_content', 'faq', 'report')),
  title text not null,
  content text not null,
  source_url text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ai_knowledge_documents(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete set null,
  chunk_index integer not null default 0,
  content text not null,
  embedding extensions.vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.ai_predictions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  member_id uuid references public.members(id) on delete cascade,
  prediction_type text not null check (prediction_type in ('engagement', 'churn', 'retention', 'revenue', 'attendance', 'demand', 'trainer_match', 'class_recommendation')),
  subject_key text not null,
  score numeric(10,2) not null default 0,
  confidence numeric(5,2) not null default 0 check (confidence >= 0 and confidence <= 100),
  horizon_days integer not null default 30,
  category text,
  explanation text not null,
  factors jsonb not null default '[]'::jsonb,
  model_version text not null default 'rules-v1',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_forecasts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  forecast_type text not null check (forecast_type in ('monthly_revenue', 'renewals', 'pt_revenue', 'class_revenue', 'attendance_peak', 'class_demand', 'trainer_demand', 'equipment_demand')),
  period_start date not null,
  period_end date not null,
  forecast_value numeric(12,2) not null,
  lower_bound numeric(12,2),
  upper_bound numeric(12,2),
  confidence numeric(5,2) not null default 0,
  explanation text not null,
  factors jsonb not null default '[]'::jsonb,
  model_version text not null default 'forecast-v1',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  insight_type text not null check (insight_type in ('progress', 'executive', 'revenue', 'attendance', 'trainer', 'class', 'retention', 'fitness')),
  title text not null,
  summary text not null,
  recommendation text not null,
  severity text not null default 'info' check (severity in ('info', 'opportunity', 'warning', 'critical')),
  confidence numeric(5,2) not null default 0,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'archived')),
  generated_by text not null default 'rules_engine' check (generated_by in ('rules_engine', 'openai', 'hybrid')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_content_drafts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  draft_type text not null check (draft_type in ('announcement', 'campaign_email', 'whatsapp_message', 'promotion', 'report_summary')),
  prompt text not null,
  content text not null,
  target_segment text,
  status text not null default 'pending_review' check (status in ('draft', 'pending_review', 'approved', 'rejected', 'published', 'archived')),
  safety_flags jsonb not null default '[]'::jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_automation_suggestions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  suggestion_type text not null check (suggestion_type in ('retention_campaign', 'renewal_follow_up', 'trainer_reassignment', 'class_promotion', 'attendance_reactivation')),
  title text not null,
  summary text not null,
  trigger_definition jsonb not null default '{}'::jsonb,
  expected_impact text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'implemented', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_observability_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  feature_key text not null,
  provider text not null default 'openai',
  model text not null,
  prompt_hash text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  latency_ms integer not null default 0,
  estimated_cost_cents numeric(10,4) not null default 0,
  status text not null default 'success' check (status in ('success', 'fallback', 'error', 'blocked')),
  safety_flags jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_fitness_profiles_member_latest on public.ai_fitness_profiles(member_id, generated_at desc);
create index if not exists idx_ai_recommendations_member_status on public.ai_recommendations(member_id, status, created_at desc);
create index if not exists idx_ai_recommendations_gym_type on public.ai_recommendations(gym_id, recommendation_type, status);
create index if not exists idx_ai_generated_programs_member_status on public.ai_generated_programs(member_id, status, created_at desc);
create index if not exists idx_ai_chat_sessions_user_status on public.ai_chat_sessions(user_id, status, updated_at desc);
create index if not exists idx_ai_chat_messages_session_time on public.ai_chat_messages(session_id, created_at);
create index if not exists idx_ai_knowledge_documents_gym_type on public.ai_knowledge_documents(gym_id, source_type, status);
create index if not exists idx_ai_knowledge_chunks_gym on public.ai_knowledge_chunks(gym_id);
create index if not exists idx_ai_predictions_gym_type on public.ai_predictions(gym_id, prediction_type, generated_at desc);
create index if not exists idx_ai_predictions_member_type on public.ai_predictions(member_id, prediction_type, generated_at desc);
create index if not exists idx_ai_forecasts_gym_type_period on public.ai_forecasts(gym_id, forecast_type, period_start desc);
create index if not exists idx_ai_insights_gym_type on public.ai_insights(gym_id, insight_type, status, created_at desc);
create index if not exists idx_ai_observability_logs_feature_time on public.ai_observability_logs(feature_key, created_at desc);

create index if not exists idx_ai_knowledge_chunks_embedding
on public.ai_knowledge_chunks
using ivfflat (embedding extensions.vector_cosine_ops)
with (lists = 100)
where embedding is not null;

drop trigger if exists set_ai_fitness_profiles_updated_at on public.ai_fitness_profiles;
create trigger set_ai_fitness_profiles_updated_at before update on public.ai_fitness_profiles for each row execute function public.set_updated_at();
drop trigger if exists set_ai_recommendations_updated_at on public.ai_recommendations;
create trigger set_ai_recommendations_updated_at before update on public.ai_recommendations for each row execute function public.set_updated_at();
drop trigger if exists set_ai_generated_programs_updated_at on public.ai_generated_programs;
create trigger set_ai_generated_programs_updated_at before update on public.ai_generated_programs for each row execute function public.set_updated_at();
drop trigger if exists set_ai_chat_sessions_updated_at on public.ai_chat_sessions;
create trigger set_ai_chat_sessions_updated_at before update on public.ai_chat_sessions for each row execute function public.set_updated_at();
drop trigger if exists set_ai_knowledge_documents_updated_at on public.ai_knowledge_documents;
create trigger set_ai_knowledge_documents_updated_at before update on public.ai_knowledge_documents for each row execute function public.set_updated_at();
drop trigger if exists set_ai_insights_updated_at on public.ai_insights;
create trigger set_ai_insights_updated_at before update on public.ai_insights for each row execute function public.set_updated_at();
drop trigger if exists set_ai_content_drafts_updated_at on public.ai_content_drafts;
create trigger set_ai_content_drafts_updated_at before update on public.ai_content_drafts for each row execute function public.set_updated_at();
drop trigger if exists set_ai_automation_suggestions_updated_at on public.ai_automation_suggestions;
create trigger set_ai_automation_suggestions_updated_at before update on public.ai_automation_suggestions for each row execute function public.set_updated_at();

alter table public.ai_fitness_profiles enable row level security;
alter table public.ai_recommendations enable row level security;
alter table public.ai_generated_programs enable row level security;
alter table public.ai_chat_sessions enable row level security;
alter table public.ai_chat_messages enable row level security;
alter table public.ai_knowledge_documents enable row level security;
alter table public.ai_knowledge_chunks enable row level security;
alter table public.ai_predictions enable row level security;
alter table public.ai_forecasts enable row level security;
alter table public.ai_insights enable row level security;
alter table public.ai_content_drafts enable row level security;
alter table public.ai_automation_suggestions enable row level security;
alter table public.ai_observability_logs enable row level security;

drop policy if exists "ai member profile visibility" on public.ai_fitness_profiles;
create policy "ai member profile visibility" on public.ai_fitness_profiles
for select to authenticated
using (
  public.is_super_admin()
  or public.can_access_gym(gym_id)
  or exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
);

drop policy if exists "ai staff profile management" on public.ai_fitness_profiles;
create policy "ai staff profile management" on public.ai_fitness_profiles
for all to authenticated
using (public.is_super_admin() or public.can_access_gym(gym_id) or public.is_trainer_for_member(member_id))
with check (public.is_super_admin() or public.can_access_gym(gym_id) or public.is_trainer_for_member(member_id));

drop policy if exists "ai recommendation visibility" on public.ai_recommendations;
create policy "ai recommendation visibility" on public.ai_recommendations
for select to authenticated
using (
  public.is_super_admin()
  or public.can_access_gym(gym_id)
  or exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or (member_id is not null and public.is_trainer_for_member(member_id))
);

drop policy if exists "ai staff recommendation management" on public.ai_recommendations;
create policy "ai staff recommendation management" on public.ai_recommendations
for all to authenticated
using (public.is_super_admin() or public.can_access_gym(gym_id) or (member_id is not null and public.is_trainer_for_member(member_id)))
with check (public.is_super_admin() or public.can_access_gym(gym_id) or (member_id is not null and public.is_trainer_for_member(member_id)));

drop policy if exists "ai chat session owner visibility" on public.ai_chat_sessions;
create policy "ai chat session owner visibility" on public.ai_chat_sessions
for all to authenticated
using (user_id = (select auth.uid()) or public.is_super_admin() or public.can_access_gym(gym_id))
with check (user_id = (select auth.uid()) or public.is_super_admin() or public.can_access_gym(gym_id));

drop policy if exists "ai chat messages follow session" on public.ai_chat_messages;
create policy "ai chat messages follow session" on public.ai_chat_messages
for all to authenticated
using (exists (select 1 from public.ai_chat_sessions s where s.id = session_id and (s.user_id = (select auth.uid()) or public.is_super_admin() or public.can_access_gym(s.gym_id))))
with check (exists (select 1 from public.ai_chat_sessions s where s.id = session_id and (s.user_id = (select auth.uid()) or public.is_super_admin() or public.can_access_gym(s.gym_id))));

drop policy if exists "staff manage ai operational data" on public.ai_knowledge_documents;
create policy "staff manage ai operational data" on public.ai_knowledge_documents
for all to authenticated
using (public.is_super_admin() or public.can_access_gym(gym_id))
with check (public.is_super_admin() or public.can_access_gym(gym_id));

drop policy if exists "staff manage ai chunks" on public.ai_knowledge_chunks;
create policy "staff manage ai chunks" on public.ai_knowledge_chunks
for all to authenticated
using (public.is_super_admin() or public.can_access_gym(gym_id))
with check (public.is_super_admin() or public.can_access_gym(gym_id));

drop policy if exists "staff read ai predictions forecasts insights" on public.ai_predictions;
create policy "staff read ai predictions forecasts insights" on public.ai_predictions
for select to authenticated
using (
  public.is_super_admin()
  or public.can_access_gym(gym_id)
  or exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or (member_id is not null and public.is_trainer_for_member(member_id))
);

drop policy if exists "staff manage ai predictions" on public.ai_predictions;
create policy "staff manage ai predictions" on public.ai_predictions
for all to authenticated
using (public.is_super_admin() or public.can_access_gym(gym_id))
with check (public.is_super_admin() or public.can_access_gym(gym_id));

drop policy if exists "staff manage ai forecasts" on public.ai_forecasts;
create policy "staff manage ai forecasts" on public.ai_forecasts
for all to authenticated
using (public.is_super_admin() or public.can_access_gym(gym_id))
with check (public.is_super_admin() or public.can_access_gym(gym_id));

drop policy if exists "staff manage ai insights" on public.ai_insights;
create policy "staff manage ai insights" on public.ai_insights
for all to authenticated
using (public.is_super_admin() or public.can_access_gym(gym_id))
with check (public.is_super_admin() or public.can_access_gym(gym_id));

drop policy if exists "staff manage ai content drafts" on public.ai_content_drafts;
create policy "staff manage ai content drafts" on public.ai_content_drafts
for all to authenticated
using (public.is_super_admin() or public.can_access_gym(gym_id))
with check (public.is_super_admin() or public.can_access_gym(gym_id));

drop policy if exists "staff manage ai automation suggestions" on public.ai_automation_suggestions;
create policy "staff manage ai automation suggestions" on public.ai_automation_suggestions
for all to authenticated
using (public.is_super_admin() or public.can_access_gym(gym_id))
with check (public.is_super_admin() or public.can_access_gym(gym_id));

drop policy if exists "staff read ai observability" on public.ai_observability_logs;
create policy "staff read ai observability" on public.ai_observability_logs
for select to authenticated
using (public.is_super_admin() or public.can_access_gym(gym_id) or user_id = (select auth.uid()));

create or replace view public.ai_member_risk_summary as
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

create or replace view public.ai_operational_summary as
select
  gym_id,
  count(*) filter (where status in ('draft', 'pending_review')) as pending_review_items,
  count(*) filter (where status = 'approved') as approved_items,
  count(*) filter (where recommendation_type = 'retention') as retention_recommendations,
  avg(confidence) as average_confidence,
  max(created_at) as latest_recommendation_at
from public.ai_recommendations
group by gym_id;

grant select, insert, update, delete on public.ai_fitness_profiles to authenticated;
grant select, insert, update, delete on public.ai_recommendations to authenticated;
grant select, insert, update, delete on public.ai_generated_programs to authenticated;
grant select, insert, update, delete on public.ai_chat_sessions to authenticated;
grant select, insert, update, delete on public.ai_chat_messages to authenticated;
grant select, insert, update, delete on public.ai_knowledge_documents to authenticated;
grant select, insert, update, delete on public.ai_knowledge_chunks to authenticated;
grant select, insert, update, delete on public.ai_predictions to authenticated;
grant select, insert, update, delete on public.ai_forecasts to authenticated;
grant select, insert, update, delete on public.ai_insights to authenticated;
grant select, insert, update, delete on public.ai_content_drafts to authenticated;
grant select, insert, update, delete on public.ai_automation_suggestions to authenticated;
grant select, insert on public.ai_observability_logs to authenticated;
grant select on public.ai_member_risk_summary to authenticated;
grant select on public.ai_operational_summary to authenticated;
