-- [SUPERSEDED by 20260624000000] Organization approval reviews now require fresh MFA, not a second Super Admin reviewer.

do $$
declare
  function_definition text;
  updated_definition text;
  blocked_review_guard_pattern text := 'if\s+v_approval\.requested_by\s+is\s+not\s+null\s+and\s+v_approval\.requested_by\s*=\s*p_reviewer_id\s+then\s+raise\s+exception\s+''Maker-checker control blocked this approval\. A different Super Admin must approve the request\.''\s+using\s+errcode\s*=\s*''42501'';\s+end\s+if;';
begin
  select pg_get_functiondef('public.apply_organization_approval_request(uuid, uuid, text)'::regprocedure)
  into function_definition;

  if function_definition is null then
    raise exception 'public.apply_organization_approval_request(uuid, uuid, text) does not exist.';
  end if;

  updated_definition := regexp_replace(function_definition, blocked_review_guard_pattern, '', 'i');

  if updated_definition = function_definition then
    raise exception 'Expected maker-checker reviewer guard was not found in apply_organization_approval_request.';
  end if;

  execute updated_definition;
end;
$$;

comment on function public.apply_organization_approval_request(uuid, uuid, text) is
  'Applies pending organization approval requests after application-enforced Super Admin MFA verification; the requester may review their own request.';
