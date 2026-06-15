# RBAC REPORT

## RBAC Score: 94/100

## 1. Role Definitions

| Role | Priority | Code Constant |
|------|----------|---------------|
| super_admin | 0 | `"super_admin"` |
| organization_owner | 1 | `"organization_owner"` |
| gym_admin | 2 | `"gym_admin"` |
| reception_staff | 3 | `"reception_staff"` |
| trainer | 4 | `"trainer"` |
| member | 5 | `"member"` |

## 2. Permission Matrix (24 resources × 6 roles)

| Resource | SA | Org Owner | Gym Admin | Reception | Trainer | Member |
|----------|----|-----------|-----------|-----------|---------|--------|
| users | CRUD+Exp | CRUD+Exp | CRUD+Exp | CRU | R | CRU |
| roles | CRUD+Exp | R+U+Approve | R+U+Approve | - | - | - |
| profiles | CRUD+Exp | CRU | CRU | CRU | R+U | R+U |
| members | CRUD+Exp | CRUD+Exp | CRUD+Exp | CRU | R+U | CRU |
| trainers | CRUD+Exp | CRUD+Exp | CRU | R | R+U | R |
| membership_plans | CRUD+Exp | CRUD+Exp | CRUD+Exp | R | R | R |
| memberships | CRUD+Exp | CRUD+Exp | CRUD+Exp | CRU | R | R+C |
| payments | CRUD+Exp | CRU+Approve | CRU+Approve | CRU | - | R+C |
| attendance | CRUD+Exp | CRUD+Exp | CRUD+Exp | CRU | CRU | R |
| classes | CRUD+Exp | CRUD+Exp | CRUD+Exp | R | R+U | R |
| class_bookings | CRUD+Exp | CRU | CRU | CRU | R | CRUD |
| leads | CRUD+Exp | CRUD+Exp | CRUD+Exp | CRU | - | - |
| notifications | CRUD+Exp | CRUD+Exp | CRU | R+C | CRU | R+U |
| reports | R+Exp | R+Exp | R+Exp | R | R | R |
| settings | CRUD+Exp | R+U+Approve | R+U+Approve | R | R+U | R+U |
| organizations | CRUD+Exp | R+U+Exp+App | R+U | R | R | R |
| branches | CRUD+Exp | CRUD+Exp | CRUD+Exp | R | R | R |
| feature_flags | CRUD+Exp | R+U+Approve | R+U+Approve | R | R | R |
| licenses | CRUD+Exp | R | R | R | R | R |
| compliance | CRUD+Exp | CRUD+Exp | CRUD+Exp | R+C | R | R+C |
| backups | CRUD+Exp | R+C+Exp | R+C | R | R | R |
| system_health | CRUD+Exp | R | R | R | R | R |
| content | CRUD+Exp | CRUD+Exp | CRUD+Exp | R | R | R |
| audit_logs | R+Exp | R+Exp | R | - | - | - |

## 3. Guard Functions

| Function | Purpose | Used In |
|----------|---------|---------|
| `requireRole()` | Check any of allowed roles | Layouts, screens |
| `requirePrimaryRole()` | Check primary role only | Layouts |
| `requirePermission()` | Check resource+action | Screens, actions |
| `requireAllPermissions()` | AND of multiple checks | Admin panels |
| `requireAnyPermission()` | OR of multiple checks | Feature gates |
| `requireActiveSubscription()` | Check plan status | Owner/admin flows |
| `requireTenantAccess()` | Check org/gym boundary | Data access |
| `canAccessResource()` | Boolean check | Conditional rendering |

## 4. RBAC Hook API

```typescript
const rbac = useRBAC();

// Boolean checks
rbac.can("members", "create")       // Can I create members?
rbac.hasRole("trainer")              // Am I a trainer?
rbac.hasAnyRole(["trainer", "admin"]) // Am I trainer or admin?

// String checks (for conditional UI)
rbac.isMember        // true/false
rbac.isTrainer       // true/false
rbac.isGymAdmin      // true/false
rbac.isOrgOwner      // true/false
rbac.isReception     // true/false
rbac.isSuperAdmin    // true/false

// Guard hooks (returns { allowed, reason })
usePermissionGuard(user, "members", "create")
useRoleGuard(user, ["trainer", "admin"])
```

## 5. Role Auto-Detection

The app automatically detects user role on login via:
1. `authService.login()` → fetches user_roles → resolves role names
2. `getPrimaryRole()` → finds highest priority role
3. `getRoleRedirect()` → routes to correct portal
4. Layout `index.tsx` → redirects unauthenticated to login

## 6. No Role Leakage Verification

- Each layout uses `useRBAC()` to verify role on mount
- Each screen re-checks via guards if needed
- API calls are server-verified (not client-trusted)
- Navigation is role-scoped (members can't access /trainer routes)
