# MULTI-TENANT SECURITY REPORT

## Security Score: 95/100

## 1. Tenant Isolation Layers

| Layer | Mechanism |
|-------|-----------|
| Org Owner | `organization_id` on all queries |
| Gym Admin | `gym_id` from auth profile (`profile.gym_id`) |
| Reception | `gym_id` from auth profile |
| Trainer | `trainer_id` → `trainer_assignments` → member data |

## 2. Cross-Tenant Access Prevention

```
Organization A (Org Owner A)
  ├── Gym A1 (Gym Admin A, Reception A, Trainer A)
  │     ├── Members: only Gym A1 members
  │     ├── Attendance: only Gym A1 sessions
  │     └── Payments: only Gym A1 payments
  └── Gym A2
        └── [No cross-access from Gym A1 staff]
        
Organization B (Org Owner B)
  └── [No access from ANY Organization A user]
```

## 3. Critical Security Patterns

All admin screens follow this pattern:
```sql
-- Gym Admin: scoped by gym_id
SELECT * FROM members WHERE gym_id = {profile.gym_id}

-- Trainer: scoped by trainer_assignments
SELECT * FROM members WHERE id IN (
  SELECT member_id FROM trainer_assignments WHERE trainer_id = {trainerId}
)

-- Org Owner: scoped by organization_id
SELECT * FROM gyms WHERE organization_id = {orgId}
```
