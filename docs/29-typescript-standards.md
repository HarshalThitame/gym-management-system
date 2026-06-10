# 29 - TypeScript Standards

## 1. TypeScript Strategy

The platform must use strict TypeScript everywhere. TypeScript is a design tool, not only a compiler check. Types should make invalid states harder to represent, especially for auth, roles, payments, membership status, attendance, and tenant-scoped data.

Required compiler posture:

- `strict` enabled.
- `noImplicitAny` enabled.
- `strictNullChecks` enabled.
- `noUncheckedIndexedAccess` recommended.
- `exactOptionalPropertyTypes` recommended.
- `noFallthroughCasesInSwitch` enabled.
- `forceConsistentCasingInFileNames` enabled.

## 2. No `any` Policy

`any` is not allowed.

Allowed alternatives:

| Situation | Use |
| --- | --- |
| Unknown external payload | `unknown`, then validate with Zod. |
| Flexible metadata | `Record<string, unknown>` or typed discriminated metadata. |
| JSONB from database | Typed JSON aliases plus runtime validation before business use. |
| Third-party SDK gaps | Narrow wrapper types in `services/{provider}`. |
| Temporary migration bridge | `unknown` with complete narrowing in the same scope. |

Rules:

- Do not use `as any`.
- Do not disable TypeScript errors to force a build.
- Do not trust client input, webhook payloads, or database JSON without validation.

## 3. Naming Conventions

| Item | Convention | Example |
| --- | --- | --- |
| Files | kebab-case | `member-status-badge.tsx` |
| Components | PascalCase | `MemberStatusBadge` |
| Hooks | camelCase with `use` prefix | `useMemberFilters` |
| Types | PascalCase | `MemberSummary` |
| Interfaces | PascalCase | `MemberRepository` |
| Zod schemas | PascalCase with `Schema` suffix | `CreateMemberSchema` |
| Actions | verb phrase | `createMemberAction` |
| Services | noun + `Service` or function group | `membershipService` |
| Repositories | noun + `Repository` | `membersRepository` |
| Constants | SCREAMING_SNAKE_CASE for global constants | `DEFAULT_PAGE_SIZE` |
| Status values | lower snake string literals | `active`, `trial_scheduled` |

## 4. File Naming Rules

| File Type | Pattern |
| --- | --- |
| React component | `component-name.tsx` |
| Server Action file | `module-name.actions.ts` |
| Service file | `module-name.service.ts` |
| Repository file | `module-name.repository.ts` |
| Schema file | `module-name.schema.ts` |
| Type file | `module-name.types.ts` |
| Constants file | `module-name.constants.ts` |
| Test file | `module-name.test.ts` or `component-name.test.tsx` |
| E2E spec | `flow-name.spec.ts` |

## 5. Type vs Interface Rules

Use `type` for:

- Unions.
- String literal unions.
- Derived types.
- Function payloads.
- API responses.
- Component props unless extension is required.

Use `interface` for:

- Service contracts.
- Repository contracts.
- Objects designed for extension.
- External adapter contracts.

Examples by intent:

| Intent | Preferred |
| --- | --- |
| Role names | String literal union type. |
| Payment status | String literal union type. |
| Repository contract | Interface. |
| Component props | Type. |
| API result union | Discriminated union type. |

## 6. Enum Strategy

Avoid TypeScript `enum` unless a third-party API requires it.

Prefer:

- `const` arrays for allowed values.
- String literal union types derived from arrays.
- Database check constraints or PostgreSQL enum values aligned with the TypeScript values.

Reason:

- String unions tree-shake well.
- Values map cleanly to database text/check constraints.
- They avoid enum runtime output and migration complexity.

## 7. API Typing Rules

All API/server action results must use a consistent discriminated response pattern.

Required response families:

| Result | Fields |
| --- | --- |
| Success | `ok: true`, `data`, optional `message`, optional `meta` |
| Failure | `ok: false`, `error` |
| Error object | `code`, `message`, optional `field_errors`, optional `details` |

Error codes should be stable strings:

- `VALIDATION_ERROR`
- `AUTH_REQUIRED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `PAYMENT_FAILED`
- `PAYMENT_PENDING`
- `DATABASE_ERROR`
- `UNKNOWN_ERROR`

Rules:

- Server Actions never throw raw errors to UI for expected failures.
- Route Handlers return typed JSON responses with status codes.
- Client components consume typed action results.
- External provider responses are adapted to internal types.

## 8. Database Type Strategy

Use generated Supabase database types as the base persistence layer.

Recommended type layers:

| Layer | Type Source | Purpose |
| --- | --- | --- |
| DB row | Generated Supabase types | Exact database shape. |
| Domain entity | Feature `types` | Business-friendly shape. |
| Form input | Zod inferred type | User input before service processing. |
| Action output | Explicit action result type | UI consumption. |
| View model | Feature component type | Optimized page/component data. |

Rules:

- Do not pass raw database rows deep into UI if the UI only needs a view model.
- Map DB rows to domain/view types in services.
- Keep generated database types in `types/database.generated.ts` or `supabase/types.ts`.

## 9. Null and Optional Handling

Rules:

- Use `null` for database-nullable fields.
- Use optional properties for request fields that may be omitted.
- Do not use `undefined` as a database state.
- Convert empty form strings to `null` where the database expects nullable values.
- Avoid non-null assertions. If a value is required, validate it.

## 10. Discriminated Union Patterns

Use discriminated unions for stateful domains:

| Domain | Discriminator |
| --- | --- |
| Payment result | `status` |
| Membership state | `status` |
| Booking state | `status` |
| Notification channel | `channel` |
| Action result | `ok` |

Benefits:

- Exhaustive handling in UI.
- Safer status-specific actions.
- Easier tests.

## 11. Component Props Rules

Component props should be:

- Explicit.
- Minimal.
- Readonly where practical.
- Domain-neutral for shared components.
- Domain-specific only inside feature modules.

Rules:

- Do not pass entire entity objects when a component needs only a few fields.
- Do not mix data fetching and rendering in client components.
- Event handlers should be typed.
- Use `React.ReactNode` only for slots/content areas, not as a substitute for clear props.

## 12. Import Rules

| Rule | Requirement |
| --- | --- |
| Path aliases | Use stable aliases such as `@/components`, `@/features`, `@/lib`. |
| Feature internals | Do not import another feature's internal repository/service directly. |
| Server-only code | Mark server-only modules and keep out of client imports. |
| Client code | Do not import Node/server modules into client components. |
| Barrels | Use module-level `index.ts` exports carefully; avoid exporting private internals. |

## 13. Date, Money, and ID Types

| Concept | Type Rule |
| --- | --- |
| IDs | UUID strings; use branded types in future if needed. |
| Dates | ISO strings at API boundary; `Date` objects only inside server logic or controlled client utilities. |
| Money | Integer smallest currency unit plus currency code. |
| Percentages | Number with documented scale, for example 0-100. |
| Timezones | Store timezone in gym settings; display through timezone-aware formatting. |

Money must never use floating point for stored amounts.

## 14. Validation Rules

Use Zod for:

- Forms.
- Server Action inputs.
- Route Handler inputs.
- Webhook payload narrowing.
- Environment variable parsing.
- Provider response narrowing where needed.

Rules:

- Input schemas live near the module that owns the input.
- Shared schemas live in `schemas/`.
- Schema-inferred types are acceptable for inputs.
- Domain output types should be explicit where transformation occurs.

## 15. TypeScript Review Checklist

- No `any`.
- No unnecessary type assertions.
- No raw external payload used without validation.
- DB nullable fields handled explicitly.
- Server-only modules not imported by client components.
- Action/API responses use consistent typed result.
- Status values use string literal unions.
- Components receive minimal typed props.
- Money uses integer amount and currency.
- Tests cover key discriminated union branches.
