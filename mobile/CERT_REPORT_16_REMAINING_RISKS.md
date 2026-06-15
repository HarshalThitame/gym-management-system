# REMAINING RISKS REPORT

## Risk Register

| # | Risk | Category | Severity | Mitigation | Status |
|---|------|----------|----------|------------|--------|
| 1 | SQLite cache not encrypted | Storage | LOW | Non-sensitive cache data only | ✅ Accepted |
| 2 | No screen capture prevention | Device | LOW | Standard for fitness apps | ✅ Accepted |
| 3 | No certificate pinning | Network | LOW | HTTPS enforced | ✅ Accepted |
| 4 | App Store screenshots not captured | Release | LOW | Pre-submission task | ✅ Known |
| 5 | Privacy policy URL not set | Legal | LOW | Needs legal review | ✅ Known |
| 6 | No biometric unlock timeout | Auth | LOW | Available as opt-in | ✅ Accepted |
| 7 | Gallery/media permissions | Privacy | LOW | Explained in app.json | ✅ Documented |

## Risk Acceptance

All 7 risks are rated LOW. None block production launch.
All accepted risks have documented mitigations or are pre-submission tasks.
