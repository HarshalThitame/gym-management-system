# Hydration Risk Inventory

## CRITICAL (Currently Causing Errors)

| # | File | Component | Code | Risk |
|---|---|---|---|---|
| C1 | `features/organization-owner/lib/use-theme.ts:25` | useTheme | `useState<Theme>(getStoredTheme)` reads localStorage during render | SSR returns "system", client returns stored value; `isDark` differs |
| C2 | `features/organization-owner/components/org-owner-layout-client.tsx:58` | LayoutToolbar | `aria-label={isDark ? ... : ...}` + `{isDark ? <Sun/> : <Moon/>}` | Theme-dependent rendering not guarded by mounted check |
| C3 | `features/super-admin/components/super-admin-dashboard.tsx:716` | SuperAdminDashboard | `const now = new Date()` in render | Current time differs on every render |
| C4 | `features/super-admin/components/subscriptions/SubscriptionRecentEvents.tsx:94` | SubscriptionRecentEvents | `const now = Date.now()` in render | Current time differs on every render |
| C5 | `app/(admin)/admin/page.tsx:90` | AdminDashboard | `const now = new Date()` in render | Current time differs on every render |
| C6 | `features/ux/hooks/use-keyboard-shortcuts.ts:16` | useKeyboardShortcuts | `navigator.platform` at module level | Server returns false, Mac client returns true |

## HIGH (Likely to Cause Errors)

| # | File | Pattern | Count | Risk |
|---|---|---|---|---|
| H1 | 50+ files | `.toLocaleDateString()` / `.toLocaleString()` in JSX | ~80 | Server locale vs client locale mismatch |
| H2 | 15+ files | `Intl.DateTimeFormat` in render utilities | ~20 | Server locale vs client locale mismatch |
| H3 | `components/ui/toast.tsx:25` | `Math.random()` for ID generation | 1 | Random ID changes on every render |
| H4 | `features/support/components/support-automation-builder.tsx:77` | `Math.random()` for ID generation | 1 | Random ID changes on every render |

## MEDIUM (Conditional)

| # | File | Pattern | Risk |
|---|---|---|---|
| M1 | Various | Dynamic `aria-label` with template literals | Safe if variable source is consistent |
| M2 | PWA provider | `navigator` checks in useMemo with SSR guards | Safe with proper guards |

## LOW (In Event Handlers/Effects Only)

| # | File | Pattern | Risk |
|---|---|---|---|
| L1 | Various | `localStorage` in useEffect | Safe - runs after hydration |
| L2 | Various | `document.*` in event handlers | Safe |
| L3 | Various | `window.*` in onClick/onChange | Safe |
