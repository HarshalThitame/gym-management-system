# REMAINING RISKS REPORT

## Residual Risk Assessment

| # | Risk | Severity | Category | Accepted? | Mitigation |
|---|------|----------|----------|-----------|------------|
| 1 | SQLite cache not encrypted | LOW | Storage | ✅ Accepted | Contains only non-sensitive cache data (workout plans, notifications). No PII. |
| 2 | No screen capture prevention | LOW | Device | ✅ Accepted | Standard for gym/fitness apps. Sensitive screens (billing) could be protected in future. |
| 3 | Member/Owner dashboards use useAuth instead of useRBAC | LOW | RBAC | ✅ Accepted | Layout guards provide auth enforcement. Screen double-check is defense-in-depth improvement. |
| 4 | Some analytics have N+1 query patterns | LOW | Performance | ✅ Accepted | Cached with 5-min TTL. Acceptable for <50 branches. |
| 5 | No certificate pinning | LOW | Network | ✅ Accepted | HTTPS enforced. Certificate pinning could be added for enterprise compliance. |
| 6 | No biometric unlock timeout | LOW | Auth | ✅ Accepted | Biometric available but re-authentication interval not configurable. |
| 7 | Deep links not validated for role | LOW | Navigation | ✅ Accepted | Expo Router handles auth state. Role-based redirects happen after auth. |

## Risk Acceptance

All 7 remaining risks are rated LOW. None present a meaningful threat to production security.
All accepted risks have documented mitigations.
