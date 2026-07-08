-- Package catalog is now managed through the super-admin UI (PackageEditorModal).
-- New installations should bootstrap packages via the admin interface at
-- /super-admin/subscriptions rather than editing migration files.
-- This migration marks the packages table as admin-managed.

comment on table public.packages is 'SaaS package definitions. Managed through the super-admin UI. Seed data is provided in migration 20260625000000 for initial setup only.';
comment on table public.package_pricing is 'Package pricing per billing period. Managed through the super-admin UI alongside packages.';
comment on table public.package_features is 'Feature-to-package mapping. Managed through the super-admin UI.';
comment on table public.package_limits is 'Resource limit-to-package mapping. Managed through the super-admin UI.';
comment on column public.packages.metadata is 'JSON metadata including pricing display labels, trial settings, and billing cycle options. Managed through the super-admin UI.';
