# Phase 16 - Advanced PWA, Mobile Experience, Offline Mode

## Scope

The platform now includes a single-codebase PWA layer for installability, app-like mobile navigation, offline fallback, local persistence, background sync intake, web push subscription storage, and mobile engagement telemetry.

## Implemented Surface

- Manifest route: `app/manifest.ts`
- Offline fallback: `app/offline/page.tsx`
- Service worker: `public/sw.js`
- PWA provider: `components/pwa/pwa-provider.tsx`
- Mobile portal bottom navigation: `components/pwa/mobile-bottom-nav.tsx`
- Member mobile readiness panel: `components/pwa/mobile-readiness-panel.tsx`
- IndexedDB utilities: `features/pwa/lib/offline-store.ts`
- PWA rules and validation: `features/pwa/lib/business-rules.ts`, `features/pwa/schemas/pwa.ts`
- API routes:
  - `POST /api/pwa/push-subscriptions`
  - `DELETE /api/pwa/push-subscriptions`
  - `POST /api/pwa/sync`
  - `POST /api/pwa/analytics`
- Database migration: `supabase/migrations/20260610110000_create_pwa_mobile_experience.sql`

## Cache Strategy

- App shell cache: public landing page, offline route, manifest, and PWA icons.
- Runtime cache: successful page navigations and general same-origin GET requests.
- API cache: GET requests use network-first behavior with cached fallback.
- Static cache: Next static files, icons, screenshots, and manifest use cache-first behavior.
- Navigation fallback: failed navigations return `/offline`.

## Offline Data Strategy

Approved offline actions are stored in IndexedDB and submitted to `/api/pwa/sync` when the device reconnects.

Queueable actions are intentionally limited to:

- Workout logs
- Nutrition logs
- Profile updates
- Attendance check-in/check-out requests
- Class booking requests

Financial operations are not queueable offline. Payment capture and refunds must remain server-verified online workflows.

## Background Sync

The service worker registers `apex-offline-sync` where browser support exists. Unsupported browsers still sync through the PWA provider on `online` events and through the member dashboard `Sync now` action.

## Push Notifications

The client supports Web Push subscription registration. Real push delivery requires VAPID keys:

- `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`

Subscriptions are stored in `pwa_push_subscriptions`. No card or sensitive payment data is stored locally.

## Mobile UX

Portal layouts now use fixed bottom navigation on mobile with a More drawer for secondary destinations. Content includes safe-area bottom padding to avoid overlap on iOS and Android devices.

## Security Rules

- Push subscription writes require authenticated users.
- Offline sync requires authenticated users.
- Offline sync stores accepted actions for server-side processing instead of blindly mutating domain tables.
- Analytics route is rate-limited and stores anonymous events only when the user is not authenticated.
- RLS policies restrict users to their own PWA data, with organization management visibility for admins.

## Testing

- Unit tests cover install platform detection, prompt rules, cache freshness, queueable action safety, and network messaging.
- E2E smoke covers manifest, service worker, icon, and offline fallback availability.

## Deployment Checklist

- Apply the Phase 16 Supabase migration.
- Configure VAPID keys if push delivery is enabled.
- Run Lighthouse PWA and mobile audits after deployment over HTTPS.
- Validate install prompts on Android Chrome, desktop Chrome/Edge, and iOS Safari.
- Validate offline fallback after first page load.
