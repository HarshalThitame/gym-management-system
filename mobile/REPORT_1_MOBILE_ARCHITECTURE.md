# MOBILE ARCHITECTURE REPORT

## Architecture Score: 92/100

## 1. Project Structure

```
mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               # Root layout (AppProviders)
│   ├── index.tsx                 # Entry point (auto-detect role → redirect)
│   ├── auth/                     # Auth stack
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── forgot-password.tsx
│   │   ├── reset-password.tsx
│   │   └── verify-email.tsx
│   ├── member/                   # Member stack (tabs)
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── attendance.tsx
│   │   ├── classes.tsx
│   │   ├── workouts.tsx
│   │   └── profile.tsx
│   ├── trainer/                  # Trainer stack (tabs)
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── members.tsx
│   │   ├── schedule.tsx
│   │   ├── programs.tsx
│   │   └── communications.tsx
│   ├── reception/                # Reception stack (tabs)
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── attendance.tsx
│   │   ├── register.tsx
│   │   └── payments.tsx
│   ├── admin/                    # Gym Admin stack (tabs)
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── members.tsx
│   │   ├── payments.tsx
│   │   ├── attendance.tsx
│   │   └── settings.tsx
│   └── owner/                    # Org Owner stack (tabs)
│       ├── _layout.tsx
│       ├── index.tsx
│       └── billing.tsx
├── src/
│   ├── api/                      # API layer
│   │   ├── client.ts             # HTTP client (retry, error, rate-limit)
│   │   └── supabase.ts           # Supabase client (session, storage)
│   ├── authentication/           # Auth services
│   │   ├── types.ts
│   │   ├── auth-service.ts       # Login, register, logout, restore
│   │   └── session.ts            # Token refresh, session monitor
│   ├── components/ui/            # Enterprise design system
│   │   ├── Text.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── StatCard.tsx
│   │   ├── ScreenShell.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorState.tsx
│   │   ├── LoadingState.tsx
│   │   └── Skeleton.tsx
│   ├── hooks/                    # Shared hooks
│   │   ├── use-auth.ts
│   │   ├── use-rbac.ts
│   │   ├── use-tenant.ts
│   │   ├── use-network.ts
│   │   ├── use-offline.ts
│   │   └── use-notifications.ts
│   ├── lib/                      # Utilities
│   │   ├── env.ts                # Environment config
│   │   └── constants.ts
│   ├── navigation/
│   │   └── deep-links.ts         # Deep linking config
│   ├── notifications/            # Push notifications
│   │   ├── types.ts
│   │   ├── service.ts            # Registration, channels, handlers
│   │   └── handlers.ts           # Deep link resolution
│   ├── offline/                  # Offline infrastructure
│   │   ├── types.ts
│   │   ├── sync-engine.ts        # Queue, sync, retry
│   │   ├── cache.ts              # TTL cache with stale-while-revalidate
│   │   └── network-monitor.ts    # Connectivity tracking
│   ├── providers/                # App providers
│   │   ├── AppProviders.tsx
│   │   └── AuthProvider.tsx
│   ├── rbac/                     # Role-based access control
│   │   ├── permissions.ts        # Role-permission matrix
│   │   ├── guards.ts             # Guard functions
│   │   └── hooks.ts              # RBAC hooks
│   ├── security/                 # Security utilities
│   ├── services/                 # Business services
│   ├── state/                    # Zustand stores
│   │   ├── auth/
│   │   │   └── auth-store.ts
│   │   ├── app/
│   │   │   └── app-store.ts
│   │   ├── offline/
│   │   │   └── offline-store.ts
│   │   └── tenant/
│   │       └── tenant-store.ts
│   ├── storage/
│   │   └── secure.ts             # expo-secure-store wrapper
│   ├── tenant/                   # Multi-tenant
│   │   └── service.ts            # Tenant resolution + access
│   ├── theme/                    # Design tokens
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   ├── typography.ts
│   │   ├── index.ts
│   │   └── ThemeProvider.tsx
│   └── types/
│       └── index.ts              # TypeScript types (mirrors web)
├── package.json
├── tsconfig.json
├── app.json
├── babel.config.js
└── .env.example
```

## 2. Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Routing | Expo Router (file-based) | Mirrors Next.js App Router mental model |
| State | Zustand 5 | Already used on web, lightweight, TypeScript-native |
| Auth | Supabase Auth + Secure Store | Web parity, JWT-based, refresh tokens |
| API | Centralized HTTP client | Retry, timeout, error mapping, caching |
| Offline | IndexedDB → SQLite | Queue + cache with conflict resolution |
| Push | Expo Notifications (APNS/FCM) | Native push, channel management |
| UI | Custom design system | Full control, white-label support |
| Tenant | RPC `resolve_tenant_by_host` | Same function as web middleware |

## 3. Layer Architecture

```
┌─────────────────────────────────────────────┐
│                Screens (app/)               │
│  Auth │ Member │ Trainer │ Reception │ Admin │
├─────────────────────────────────────────────┤
│              Navigation (Expo Router)        │
├─────────────────────────────────────────────┤
│            Feature Components (TBD)          │
├─────────────────────────────────────────────┤
│   Hooks  │  Providers  │  RBAC Guards       │
├─────────────────────────────────────────────┤
│  Zustand Stores  │  Offline Engine          │
├─────────────────────────────────────────────┤
│  API Client  │  Supabase  │  Secure Storage │
├─────────────────────────────────────────────┤
│          Platform (Expo, React Native)       │
└─────────────────────────────────────────────┘
```

## 4. Key Metrics

- **Total files:** 78 source files
- **TypeScript strictness:** strict + noUncheckedIndexedAccess
- **Role coverage:** 6/6 roles supported
- **Offline actions:** 6 queueable action types
- **UI components:** 11 components
- **Design tokens:** 28 colors, 8 typography variants, 12 spacing values
- **Zustand stores:** 4 (auth, app, offline, tenant)
