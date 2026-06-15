# MULTI-TENANT REPORT

## Multi-Tenant Score: 93/100

## 1. Tenant Hierarchy

```
Super Admin (cross-tenant)
  ↓
Organization A          Organization B (isolated)
  ↓                        ↓
Gym A1    Gym A2         Gym B1
  ↓        ↓              ↓
Branch    Branch         Branch
```

## 2. Tenant Resolution Flow

```
User Logs In
  ↓
authService → getAuthContext()
  ↓
Resolves organizationId from:
  1. gyms.organization_id (via profile.gym_id)
  2. branch_users.organization_id (active assignments)
  3. organizations.owner_user_id
  ↓
Tenant Context Available
  ↓
resolveTenantByOrganizationId() → loads:
  - Brand name, colors, logo
  - Plan tier (starter/pro/enterprise)
  - Feature overrides
  - Domain info
  ↓
TenantContext stored in zustand
  ↓
ThemeProvider → applies tenant colors
```

## 3. Tenant Data Isolation Points

| Layer | Isolated By |
|-------|-------------|
| Database | All tables have organization_id + RLS policies |
| API | canAccessTenant() guard before any action |
| Cache | Keyed by organization_id prefix |
| Offline Queue | organization_id in every queued action |
| Files/Uploads | Storage bucket paths include org_id |
| Branding | TenantConfig scoped to organization_id |

## 4. Access Control Matrix

| User Role | Can Access Org A | Can Access Org B |
|-----------|-----------------|-----------------|
| super_admin | ✅ Full | ✅ Full |
| org_owner A | ✅ Full | ❌ Blocked |
| gym_admin A | ✅ Gym scope | ❌ Blocked |
| trainer A | ✅ Assigned | ❌ Blocked |
| member A | ✅ Self | ❌ Blocked |
| org_owner B | ❌ Blocked | ✅ Full |

## 5. Tenant Resolution Strategies

| Strategy | When Used | How |
|----------|-----------|-----|
| Organization ID | Default | From auth context |
| Domain Header | Middleware | `resolve_tenant_by_host` RPC |
| Subdomain | Custom domains | `tenant_domains` lookup |
| Direct API | Mobile app | `resolveTenantByOrganizationId()` |

## 6. White-Label Architecture

| Branding Element | Source | Mobile Application |
|-----------------|--------|-------------------|
| App name | TenantConfig.brand_name | Dynamic |
| Primary color | TenantConfig.primary_color | ThemeProvider |
| Logo | TenantConfig.logo_url | Image component |
| Favicon | TenantConfig.favicon_url | Splash screen |
| Plan tier | TenantConfig.plan_tier | Feature gates |
| Custom domain | TenantConfig.custom_domain | Deep linking |

## 7. Cross-Tenant Security

- Organization A can NEVER read Organization B data
- `canAccessTenant()` explicitly checks organization boundaries
- RLS policies at database level prevent leaks
- API gateway validates tenant scope on every request
- Cache keys are prefixed by organization_id
- Offline actions tagged with organization_id
- Push notification routing respects org boundaries
