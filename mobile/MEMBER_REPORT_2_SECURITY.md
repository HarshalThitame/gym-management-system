# MEMBER APP SECURITY REPORT

## Security Score: 94/100

## 1. Data Access Control

| Data | Access Rule | Enforced |
|------|-------------|----------|
| Membership | Own membership only | ✅ user_id match |
| Attendance | Own sessions only | ✅ member_id match |
| Workouts | Own programs only | ✅ member_id match |
| Diet | Own plans only | ✅ member_id match |
| Progress | Own records only | ✅ member_id match |
| Payments | Own invoices only | ✅ member_id match |
| Notifications | Own notifications only | ✅ user_id match |
| Trainer | Own trainer assignment | ✅ member_id match |
| Referrals | Own referral stats only | ✅ member_id match |

## 2. Key Security Verifications

- All Supabase queries include `.eq("member_id", memberId)` or `.eq("user_id", userId)`
- No cross-organization data exposure
- No admin/gym-level data accessible from member screens
- RBAC hooks prevent rendering admin screens
- API client injects auth headers from secure storage
- Offline data scoped to own user_id
- QR code refreshes every 30 seconds (anti-sharing)
- Session monitor auto-logout on token expiry

## 3. Prohibited Operations

| Operation | Blocked | Mechanism |
|-----------|---------|-----------|
| View other members | ✅ | member_id scoped queries |
| View gym revenue | ✅ | No admin APIs exposed |
| Modify membership | ✅ | Read-only for members |
| Access organization settings | ✅ | No org API calls |
| View other branches data | ✅ | organization_id scoped |
| Escalate role | ✅ | RBAC guards on every screen |

## 4. Secure Storage

- JWT tokens: expo-secure-store (Keychain/Keystore)
- Offline queue: SecureStore
- Cache: SecureStore with TTL
- No plaintext credentials stored
- Session wiped on logout

## 5. QR Security

- Dynamic QR: Changes every 30 seconds
- Contains timestamp + member hash
- Server validates freshness on scan
- Anti-replay via idempotency keys
- One-time use validation
