# CONFLICT RESOLUTION REPORT

## Score: 86/100

## 1. Conflict Resolution Strategies

| Strategy | Rule | When Used |
|----------|------|-----------|
| last_write_wins | Compare `_queuedAt` vs `updated_at` — newest wins | attendance, workouts, follow-ups |
| timestamp_merge | Server data base + merge non-conflicting local fields | notes, profile partial updates |
| server_wins | Server data fully overrides local | billing, registrations, class bookings |
| client_wins | Local data fully overrides server | profile updates |

## 2. Conflict Storage

Conflicts stored in SecureStore as `ConflictRecord[]`:
```typescript
interface ConflictRecord {
  actionId: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  resolvedData: Record<string, unknown> | null;
  strategy: ConflictStrategy;
  status: "pending" | "resolved" | "discarded";
}
```

## 3. Auto-Resolution Flow

```
Conflict Detected (409)
  ↓
Apply strategy: last_write_wins
  ├── Local newer → Retry with force flag
  └── Server newer → Discard local change
  ↓
Store resolved conflict (audit trail)
  ↓
Continue sync
```

## 4. Resolution Quality

| Scenario | Resolution | Data Loss Risk |
|----------|-----------|----------------|
| Same attendance twice | last_write_wins → server dedup | None |
| Lead updated offline then online | last_write_wins → newest wins | Low (loses one version) |
| Notes added offline | timestamp_merge → append | None |
| Profile photo changed | client_wins → local wins | Low |
| Payment initiated offline | server_wins → rejected | None (billing must be online) |
