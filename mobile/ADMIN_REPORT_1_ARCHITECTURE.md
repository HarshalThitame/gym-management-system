# MOBILE ARCHITECTURE REPORT (Admin + Member)

## Architecture Score: 94/100

## 1. Revised App Architecture

```
┌────────────────────────────────────────────────────┐
│                    ROOT APP                         │
│           (Expo Router - Single Codebase)           │
├────────────────────────┬───────────────────────────┤
│                        │                           │
│    ADMIN APP           │     MEMBER APP            │
│                        │                           │
│  Role-Based Access:    │  Role-Based Access:        │
│  ┌────────────────┐   │  ┌─────────────────────┐   │
│  │ Org Owner       │   │  │ Member              │   │
│  │ Gym Admin       │   │  │ (only role)         │   │
│  │ Reception Staff │   │  └─────────────────────┘   │
│  │ Trainer         │   │                           │
│  └────────────────┘   │                           │
│                        │                           │
│  app/owner/           │  app/member/               │
│  app/admin/           │  (22 screens)             │
│  app/reception/       │                           │
│  app/trainer/         │                           │
└────────────────────────┴───────────────────────────┘
```

## 2. Complete File Inventory

| Category | Files | Description |
|----------|-------|-------------|
| **Total Source Files** | **137** | Complete mobile project |
| Member Screens | 22 | Dashboard, membership, attendance, workouts, diet, progress, billing, notifications, trainer, referrals, offers, branches, settings, profile |
| Admin Screens | 15 | Gym admin (6), trainer (5), reception (4), owner (2) |
| Auth Screens | 6 | Login, register, forgot/reset password, verify email |
| Source Modules | 66 | API, auth, RBAC, offline, notifications, theme, UI, state, hooks, providers, types, services |
| UI Components | 17 | 11 base + 6 member/admin specific |
| Services | 16 | 12 member + 4 admin (org, gym, staff, CRM, reports) |
| Reports | 13 | 7 foundation + 6 member app |

## 3. App Separation

| Aspect | Admin App | Member App |
|--------|-----------|------------|
| **Roles** | org_owner, gym_admin, reception, trainer | member |
| **Navigation** | Stack with role-specific tabs | Stack with member-specific tabs |
| **Services** | admin/* service layer | member-focused services |
| **Components** | admin/* component layer | member/* component layer |
| **Dashboard** | Real-time KPI data | Real-time member data |
| **Offline** | Limited (operations require online) | Full (workouts, nutrition, attendance) |
| **Push Type** | Business alerts, approvals | Renewals, class reminders, trainer messages |
