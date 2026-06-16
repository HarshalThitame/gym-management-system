-- ============================================================
-- SAFE MIGRATION: Deprecate "Gym" concept, promote "Branch"
-- ============================================================
-- This migration is SAFE and REVERSIBLE.
-- It does NOT drop any tables or columns.
-- It adds compatibility views and updates metadata only.
-- ============================================================

-- 1. Update organization_type enum values (soft migration)
--    'single_gym' → still valid but deprecated
--    New organizations should use 'single_branch' or 'multi_branch'

-- 2. Add a database comment marking gyms table as deprecated
COMMENT ON TABLE public.gyms IS 'DEPRECATED: Use branches table instead. Gyms are being replaced by branches/locations directly under organizations.';

-- 3. Create a view that maps gyms to branches for backward compatibility
--    This helps any legacy queries that expect gym data
CREATE OR REPLACE VIEW public.gym_compat AS
SELECT 
  g.id AS gym_id,
  g.name AS gym_name,
  g.slug AS gym_slug,
  g.organization_id,
  g.status AS gym_status,
  g.timezone,
  g.currency,
  g.created_at,
  g.updated_at,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('branch_id', b.id, 'branch_name', b.name, 'branch_code', b.branch_code, 'status', b.status))
     FROM public.branches b WHERE b.gym_id = g.id AND b.organization_id = g.organization_id),
    '[]'::jsonb
  ) AS branches
FROM public.gyms g;

COMMENT ON VIEW public.gym_compat IS 'Backward-compatible view mapping gyms to their branches. Will be removed after full gym deprecation.';

-- 4. Add helper function to get branch count for an organization
CREATE OR REPLACE FUNCTION public.get_organization_branch_count(org_id UUID)
RETURNS INTEGER
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.branches
  WHERE organization_id = org_id
    AND status IN ('active', 'planned', 'maintenance');
$$;

COMMENT ON FUNCTION public.get_organization_branch_count IS 'Returns the count of active/planned/maintenance branches for an organization.';

-- 5. Add helper function to check if a gym has active branches (for migration safety)
CREATE OR REPLACE FUNCTION public.gym_has_active_branches(gym_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.branches 
    WHERE gym_id = gym_id AND status = 'active'
  );
$$;

-- 6. Add organization_type backward compatibility
--    Map 'single_gym' → treated as 'single_branch' going forward
CREATE OR REPLACE FUNCTION public.get_effective_organization_type(org_id UUID)
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT CASE 
    WHEN o.organization_type = 'single_gym' THEN 'single_branch'
    ELSE o.organization_type
  END
  FROM public.organizations o
  WHERE o.id = org_id;
$$;

COMMENT ON FUNCTION public.get_effective_organization_type IS 'Returns the effective organization type, mapping deprecated single_gym to single_branch.';
