-- QA Phase 11 remediation.
-- Scope: tighten AI operational RLS and prevent cross-tenant announcement visibility.

drop policy if exists "ai member profile visibility" on public.ai_fitness_profiles;
create policy "ai member profile visibility" on public.ai_fitness_profiles
for select to authenticated
using (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
);

drop policy if exists "ai staff profile management" on public.ai_fitness_profiles;
create policy "ai profile insert in allowed scope" on public.ai_fitness_profiles
for insert to authenticated
with check (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or public.is_trainer_for_member(member_id)
);

drop policy if exists "ai profile update in allowed scope" on public.ai_fitness_profiles;
create policy "ai profile update in allowed scope" on public.ai_fitness_profiles
for update to authenticated
using (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or public.is_trainer_for_member(member_id)
)
with check (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or public.is_trainer_for_member(member_id)
);

drop policy if exists "ai profile delete in manager scope" on public.ai_fitness_profiles;
create policy "ai profile delete in manager scope" on public.ai_fitness_profiles
for delete to authenticated
using (public.is_super_admin() or public.can_manage_gym(gym_id));

drop policy if exists "ai recommendation visibility" on public.ai_recommendations;
create policy "ai recommendation visibility" on public.ai_recommendations
for select to authenticated
using (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or (member_id is not null and public.is_trainer_for_member(member_id))
);

drop policy if exists "ai staff recommendation management" on public.ai_recommendations;
create policy "ai recommendation insert in allowed scope" on public.ai_recommendations
for insert to authenticated
with check (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or (member_id is not null and public.is_trainer_for_member(member_id))
);

drop policy if exists "ai recommendation update in reviewer scope" on public.ai_recommendations;
create policy "ai recommendation update in reviewer scope" on public.ai_recommendations
for update to authenticated
using (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or (member_id is not null and public.is_trainer_for_member(member_id))
)
with check (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or (member_id is not null and public.is_trainer_for_member(member_id))
);

drop policy if exists "ai recommendation delete in manager scope" on public.ai_recommendations;
create policy "ai recommendation delete in manager scope" on public.ai_recommendations
for delete to authenticated
using (public.is_super_admin() or public.can_manage_gym(gym_id));

drop policy if exists "ai generated programs visibility" on public.ai_generated_programs;
create policy "ai generated programs visibility" on public.ai_generated_programs
for select to authenticated
using (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = (select auth.uid()))
  or (member_id is not null and public.is_trainer_for_member(member_id))
);

drop policy if exists "ai generated programs trainer insert" on public.ai_generated_programs;
create policy "ai generated programs trainer insert" on public.ai_generated_programs
for insert to authenticated
with check (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = (select auth.uid()))
  or (member_id is not null and public.is_trainer_for_member(member_id))
);

drop policy if exists "ai generated programs reviewer update" on public.ai_generated_programs;
create policy "ai generated programs reviewer update" on public.ai_generated_programs
for update to authenticated
using (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = (select auth.uid()))
  or (member_id is not null and public.is_trainer_for_member(member_id))
)
with check (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or exists (select 1 from public.trainers t where t.id = trainer_id and t.user_id = (select auth.uid()))
  or (member_id is not null and public.is_trainer_for_member(member_id))
);

drop policy if exists "ai generated programs manager delete" on public.ai_generated_programs;
create policy "ai generated programs manager delete" on public.ai_generated_programs
for delete to authenticated
using (public.is_super_admin() or public.can_manage_gym(gym_id));

drop policy if exists "ai chat session owner visibility" on public.ai_chat_sessions;
create policy "ai chat session owner visibility" on public.ai_chat_sessions
for all to authenticated
using (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or public.can_manage_gym(gym_id)
)
with check (
  user_id = (select auth.uid())
  or public.is_super_admin()
  or public.can_manage_gym(gym_id)
);

drop policy if exists "ai chat messages follow session" on public.ai_chat_messages;
create policy "ai chat messages follow session" on public.ai_chat_messages
for all to authenticated
using (
  exists (
    select 1
    from public.ai_chat_sessions s
    where s.id = session_id
      and (
        s.user_id = (select auth.uid())
        or public.is_super_admin()
        or public.can_manage_gym(s.gym_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.ai_chat_sessions s
    where s.id = session_id
      and (
        s.user_id = (select auth.uid())
        or public.is_super_admin()
        or public.can_manage_gym(s.gym_id)
      )
  )
);

drop policy if exists "staff manage ai operational data" on public.ai_knowledge_documents;
create policy "managers manage ai knowledge documents" on public.ai_knowledge_documents
for all to authenticated
using (public.is_super_admin() or public.can_manage_gym(gym_id))
with check (public.is_super_admin() or public.can_manage_gym(gym_id));

drop policy if exists "staff manage ai chunks" on public.ai_knowledge_chunks;
create policy "managers manage ai chunks" on public.ai_knowledge_chunks
for all to authenticated
using (public.is_super_admin() or public.can_manage_gym(gym_id))
with check (public.is_super_admin() or public.can_manage_gym(gym_id));

drop policy if exists "staff read ai predictions forecasts insights" on public.ai_predictions;
create policy "ai predictions visible in allowed scope" on public.ai_predictions
for select to authenticated
using (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()))
  or (member_id is not null and public.is_trainer_for_member(member_id))
);

drop policy if exists "staff manage ai predictions" on public.ai_predictions;
create policy "managers manage ai predictions" on public.ai_predictions
for all to authenticated
using (public.is_super_admin() or public.can_manage_gym(gym_id))
with check (public.is_super_admin() or public.can_manage_gym(gym_id));

drop policy if exists "staff manage ai forecasts" on public.ai_forecasts;
create policy "managers manage ai forecasts" on public.ai_forecasts
for all to authenticated
using (public.is_super_admin() or public.can_manage_gym(gym_id))
with check (public.is_super_admin() or public.can_manage_gym(gym_id));

drop policy if exists "staff manage ai insights" on public.ai_insights;
create policy "managers manage ai insights" on public.ai_insights
for all to authenticated
using (public.is_super_admin() or public.can_manage_gym(gym_id))
with check (public.is_super_admin() or public.can_manage_gym(gym_id));

drop policy if exists "staff manage ai content drafts" on public.ai_content_drafts;
create policy "managers manage ai content drafts" on public.ai_content_drafts
for all to authenticated
using (public.is_super_admin() or public.can_manage_gym(gym_id))
with check (public.is_super_admin() or public.can_manage_gym(gym_id));

drop policy if exists "staff manage ai automation suggestions" on public.ai_automation_suggestions;
create policy "managers manage ai automation suggestions" on public.ai_automation_suggestions
for all to authenticated
using (public.is_super_admin() or public.can_manage_gym(gym_id))
with check (public.is_super_admin() or public.can_manage_gym(gym_id));

drop policy if exists "staff read ai observability" on public.ai_observability_logs;
create policy "ai observability visible in allowed scope" on public.ai_observability_logs
for select to authenticated
using (
  public.is_super_admin()
  or public.can_manage_gym(gym_id)
  or user_id = (select auth.uid())
);

drop policy if exists "announcements visible in scope" on public.announcements;
create policy "announcements visible in scope"
on public.announcements for select to authenticated
using (
  (
    status in ('published', 'scheduled')
    and (gym_id is null or gym_id = public.current_user_gym_id())
  )
  or public.is_super_admin()
  or (gym_id = public.current_user_gym_id() and public.has_any_role(array['gym_admin', 'reception_staff']))
);
