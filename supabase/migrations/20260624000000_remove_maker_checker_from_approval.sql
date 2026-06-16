-- Remove maker-checker requirement from organization approval function.
-- A single authenticated Super Admin can now approve organization governance requests.
-- The old regex-based migration (20260616173000) may not have applied correctly,
-- so this migration cleanly replaces the function definition.

create or replace function public.apply_organization_approval_request(
  p_approval_id uuid,
  p_reviewer_id uuid,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approval public.organization_approval_requests%rowtype;
  v_org public.organizations%rowtype;
  v_payload jsonb;
  v_now timestamptz := now();
  v_new_owner_user_id uuid;
  v_previous_owner_user_id uuid;
  v_role_id uuid;
  v_branch_id uuid;
  v_restore_until timestamptz;
  v_settings jsonb;
  v_governance jsonb;
  v_soft_delete jsonb;
  v_permanent_purge jsonb;
  v_package_id uuid;
  v_subscription_status text;
  v_dependency_count integer := 0;
  v_purged_slug text;
begin
  if auth.role() <> 'service_role' and not public.is_super_admin() then
    raise exception 'Only Super Admins can apply organization approvals.'
      using errcode = '42501';
  end if;

  if p_reviewer_id is null then
    raise exception 'Reviewer is required.'
      using errcode = '22023';
  end if;

  select *
  into v_approval
  from public.organization_approval_requests
  where id = p_approval_id
  for update;

  if not found then
    raise exception 'Approval request was not found.'
      using errcode = 'P0002';
  end if;

  if v_approval.status <> 'pending' then
    raise exception 'This approval request is already %.', v_approval.status
      using errcode = '22023';
  end if;

  if v_approval.expires_at <= v_now then
    update public.organization_approval_requests
    set
      status = 'expired',
      reviewed_by = p_reviewer_id,
      reviewed_at = v_now,
      review_note = coalesce(p_review_note, 'Expired before review.')
    where id = v_approval.id;

    raise exception 'This approval request has expired. Create a fresh request.'
      using errcode = '22023';
  end if;

  select *
  into v_org
  from public.organizations
  where id = v_approval.organization_id
  for update;

  if not found then
    raise exception 'Organization was not found.'
      using errcode = 'P0002';
  end if;

  v_payload := coalesce(v_approval.payload, '{}'::jsonb);

  if v_approval.action = 'transfer_owner' then
    v_new_owner_user_id := nullif(v_payload->>'newOwnerUserId', '')::uuid;
    v_previous_owner_user_id := v_org.owner_user_id;

    if v_new_owner_user_id is null then
      raise exception 'Approval payload is missing the new owner.'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from public.profiles p
      where p.id = v_new_owner_user_id
        and p.status in ('active', 'invited')
    ) then
      raise exception 'The requested new owner is no longer active.'
        using errcode = '22023';
    end if;

    select id
    into v_role_id
    from public.roles
    where name = 'organization_owner'
    limit 1;

    if v_role_id is null then
      raise exception 'Organization owner role is not configured.'
        using errcode = 'P0002';
    end if;

    insert into public.user_roles (user_id, role_id, gym_id, assigned_by)
    values (v_new_owner_user_id, v_role_id, null, p_reviewer_id)
    on conflict do nothing;

    select id
    into v_branch_id
    from public.branches
    where organization_id = v_org.id
    order by case when status = 'active' then 0 else 1 end, created_at asc
    limit 1;

    if v_branch_id is not null then
      if v_previous_owner_user_id is not null and v_previous_owner_user_id <> v_new_owner_user_id then
        update public.branch_users
        set
          status = 'revoked',
          updated_at = v_now
        where organization_id = v_org.id
          and user_id = v_previous_owner_user_id
          and role_name = 'organization_owner'
          and status = 'active';
      end if;

      insert into public.branch_users (
        organization_id,
        branch_id,
        user_id,
        role_name,
        branch_role,
        access_scope,
        status,
        permissions,
        assigned_by
      )
      values (
        v_org.id,
        v_branch_id,
        v_new_owner_user_id,
        'organization_owner',
        'owner',
        'organization',
        'active',
        '{}'::jsonb,
        p_reviewer_id
      )
      on conflict (branch_id, user_id) do update
      set
        organization_id = excluded.organization_id,
        role_name = excluded.role_name,
        branch_role = excluded.branch_role,
        access_scope = excluded.access_scope,
        status = excluded.status,
        permissions = excluded.permissions,
        assigned_by = excluded.assigned_by,
        updated_at = v_now;
    end if;

    update public.organizations
    set
      owner_user_id = v_new_owner_user_id,
      updated_at = v_now
    where id = v_org.id;

  elsif v_approval.action in ('suspend', 'bulk_suspend') then
    update public.organizations
    set
      status = 'suspended',
      updated_at = v_now
    where id = v_org.id;

  elsif v_approval.action = 'delete' then
    v_restore_until := coalesce(nullif(v_payload->>'restoreUntil', '')::timestamptz, v_now + interval '30 days');
    v_settings := coalesce(v_org.settings, '{}'::jsonb);
    v_governance := coalesce(v_settings->'governance', '{}'::jsonb);
    v_soft_delete := jsonb_build_object(
      'deletedAt', v_now,
      'restoreUntil', v_restore_until,
      'deletedBy', p_reviewer_id,
      'reason', v_approval.reason,
      'approvalId', v_approval.id,
      'restoredAt', null,
      'restoredBy', null
    );
    v_settings := jsonb_set(v_settings, '{governance}', v_governance, true);
    v_settings := jsonb_set(v_settings, '{governance,softDelete}', v_soft_delete, true);

    update public.organizations
    set
      status = 'archived',
      settings = v_settings,
      updated_at = v_now
    where id = v_org.id;

  elsif v_approval.action = 'bulk_assign_package' then
    v_package_id := nullif(v_payload->>'packageId', '')::uuid;
    v_subscription_status := coalesce(nullif(v_payload->>'status', ''), 'active');

    if v_package_id is null then
      raise exception 'Approval payload is missing the package.'
        using errcode = '22023';
    end if;

    if v_subscription_status not in ('active', 'trial', 'expired', 'suspended', 'cancelled') then
      v_subscription_status := 'active';
    end if;

    insert into public.organization_subscriptions (
      organization_id,
      package_id,
      status,
      expires_at,
      trial_ends_at,
      assigned_by,
      notes
    )
    values (
      v_org.id,
      v_package_id,
      v_subscription_status,
      null,
      null,
      p_reviewer_id,
      v_approval.reason
    )
    on conflict (organization_id) do update
    set
      package_id = excluded.package_id,
      status = excluded.status,
      expires_at = excluded.expires_at,
      trial_ends_at = excluded.trial_ends_at,
      assigned_by = excluded.assigned_by,
      notes = excluded.notes,
      updated_at = v_now;

  elsif v_approval.action = 'permanent_purge' then
    if v_org.status <> 'archived' then
      raise exception 'Organization must be soft-deleted before permanent purge.'
        using errcode = '22023';
    end if;

    if coalesce(v_org.settings #>> '{governance,legalHold,active}', 'false') = 'true' then
      raise exception 'Legal hold is active. Release the legal hold before requesting permanent purge.'
        using errcode = '42501';
    end if;

    if nullif(v_org.settings #>> '{governance,softDelete,restoreUntil}', '') is not null
       and (v_org.settings #>> '{governance,softDelete,restoreUntil}')::timestamptz > v_now then
      raise exception 'Restore window is still open. Permanent purge is blocked until the window closes.'
        using errcode = '42501';
    end if;

    select
      (select count(*) from public.gyms where organization_id = v_org.id)
      + (select count(*) from public.branches where organization_id = v_org.id)
      + (select count(*) from public.branch_users where organization_id = v_org.id)
      + (select count(*) from public.tenant_domains where organization_id = v_org.id)
      + (select count(*) from public.members m join public.gyms g on g.id = m.gym_id where g.organization_id = v_org.id)
      + (select count(*) from public.payments p join public.gyms g on g.id = p.gym_id where g.organization_id = v_org.id)
    into v_dependency_count;

    if v_dependency_count > 0 then
      raise exception 'Permanent purge blocked because tenant dependencies remain.'
        using errcode = '42501';
    end if;

    delete from public.organization_subscriptions where organization_id = v_org.id;
    delete from public.platform_subscriptions where organization_id = v_org.id;
    delete from public.feature_flags where organization_id = v_org.id;
    delete from public.tenant_configs where organization_id = v_org.id;

    v_settings := coalesce(v_org.settings, '{}'::jsonb);
    v_governance := coalesce(v_settings->'governance', '{}'::jsonb);
    v_permanent_purge := jsonb_build_object(
      'requestedAt', coalesce(v_payload->>'requestedAt', v_approval.requested_at::text),
      'completedAt', v_now,
      'requestedBy', v_approval.requested_by,
      'approvedBy', p_reviewer_id,
      'approvalId', v_approval.id,
      'reason', v_approval.reason,
      'mode', 'retained_governance_tombstone'
    );
    v_purged_slug := 'purged-' || left(replace(v_org.id::text, '-', ''), 12);

    update public.organizations
    set
      name = 'Purged organization ' || left(replace(v_org.id::text, '-', ''), 8),
      slug = v_purged_slug,
      primary_domain = null,
      billing_email = null,
      owner_user_id = null,
      settings = jsonb_build_object(
        'governance',
        jsonb_build_object(
          'softDelete', coalesce(v_governance->'softDelete', '{}'::jsonb),
          'legalHold', jsonb_build_object('active', false, 'reason', null, 'updatedAt', v_now, 'updatedBy', p_reviewer_id),
          'permanentPurge', v_permanent_purge
        )
      ),
      updated_at = v_now
    where id = v_org.id;

  else
    raise exception 'Unsupported approval action.'
      using errcode = '22023';
  end if;

  update public.organization_approval_requests
  set
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = v_now,
    review_note = p_review_note
  where id = v_approval.id;

  return jsonb_build_object(
    'approvalId', v_approval.id,
    'organizationId', v_approval.organization_id,
    'action', v_approval.action,
    'status', 'approved',
    'reviewedAt', v_now
  );
end;
$$;

comment on function public.apply_organization_approval_request(uuid, uuid, text) is
  'Atomically applies a pending organization approval request and marks it approved under row locks. Single Super Admin can approve after MFA verification.';
