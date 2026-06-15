# RBAC REPORT (Updated)

## RBAC Score: 96/100

## 1. Admin Role Permissions

| Resource | Org Owner | Gym Admin | Reception | Trainer | Member |
|----------|-----------|-----------|-----------|---------|--------|
| members | CRUD+Export | CRUD+Export | CRU | R+U | CRU |
| attendance | CRUD+Export | CRUD+Export | CRU | CRU | R |
| payments | CRU+Approve | CRU+Approve | CRU | - | R+C |
| classes | All | All | R | R+U | R+Book |
| membership_plans | All | All | R | R | R |
| trainers | CRUD+Export | CRU | R | R+U | R |
| leads | CRUD+Export | CRUD+Export | CRU | - | - |
| reports | R+Export | R+Export | - | - | R |
| settings | R+U+Approve | R+U+Approve | R | R+U | R+U |
| branches | All | All | R | R | R |

## 2. Navigation Guards

```
app/_layout.tsx → Role Detection → Redirect
  ├── /auth/* → Unauthenticated users
  ├── /member/* → Members (useRBAC().isMember)
  ├── /trainer/* → Trainers (useRBAC().isTrainer)
  ├── /reception/* → Reception (useRBAC().isReception)
  ├── /admin/* → Gym Admins (useRBAC().isGymAdmin)
  └── /owner/* → Org Owners (useRBAC().isOrgOwner)
```

## 3. Admin Permission Guard Functions

```typescript
// Example: Require gym admin for member creation
const { allowed } = usePermissionGuard(user, "members", "create");
if (!allowed) return <Unauthorized />;

// Example: Check role for staff management
const { allowed } = useRoleGuard(user, ["organization_owner", "gym_admin"]);
if (!allowed) return <Unauthorized />;
```
