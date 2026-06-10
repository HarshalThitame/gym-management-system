# 33 - Authorization RBAC and Permission Matrix

## 1. RBAC Strategy

The authorization system combines:

- Role-based permissions.
- Gym/tenant scope.
- Resource ownership.
- Trainer assignment checks.
- Server-side authorization.
- PostgreSQL RLS.

Roles are coarse-grained; permissions are action-specific. MVP can hardcode permission mappings in `lib/rbac` while storing roles in the database. Future phases can move to dynamic permission records if needed.

## 2. Permission Actions

Required action verbs:

| Action | Meaning |
| --- | --- |
| Read | View records or details. |
| Create | Add new records. |
| Update | Modify existing records. |
| Delete | Delete/archive records. |
| Export | Export/report data outside UI. |
| Approve | Approve sensitive actions, publish content, refunds, or overrides. |

Delete should usually mean archive/soft delete for business data.

## 3. Resource Groups

| Resource | Examples |
| --- | --- |
| Users | Application users, staff invites, account status. |
| Roles | Role assignment and permission management. |
| Members | Member profiles and lifecycle. |
| Trainers | Trainer profiles and assignments. |
| Membership Plans | Plan catalog. |
| Memberships | Member membership records. |
| Payments | Online/offline payments, receipts, refunds. |
| Attendance | Check-ins and corrections. |
| Classes | Class schedules and bookings. |
| Leads | Inquiries, free trials, conversion. |
| Notifications | In-app and email notification templates. |
| Reports | Dashboard metrics, exports. |
| Settings | Gym profile, integrations, notification settings. |
| Content | Blogs, testimonials, gallery, public trainer profiles. |
| Audit Logs | Critical action history. |

## 4. Permission Matrix

Legend:

- All: all gyms/tenants.
- Gym: assigned gym only.
- Own: own records only.
- Assigned: assigned member/class only.
- Limited: subset of fields/actions.
- None: no permission.

| Resource | Action | Super Admin | Gym Admin | Reception Staff | Trainer | Member |
| --- | --- | --- | --- | --- | --- | --- |
| Users | Read | All | Gym | Limited gym | Own | Own |
| Users | Create | All | Gym staff/member | Member invite limited | None | Self-register |
| Users | Update | All | Gym limited | Member contact limited | Own limited | Own limited |
| Users | Delete | All | Archive gym users | None | None | None |
| Users | Export | All | Gym | None | None | None |
| Users | Approve | All | Staff invite approval | None | None | None |
| Roles | Read | All | Gym assignments | None | None | None |
| Roles | Create | All | None | None | None | None |
| Roles | Update | All | Assign gym roles limited | None | None | None |
| Roles | Delete | All | None | None | None | None |
| Members | Read | All | Gym | Gym limited | Assigned | Own |
| Members | Create | All | Gym | Gym limited | None | Self profile only |
| Members | Update | All | Gym | Contact/status limited | Assigned fitness notes limited | Own limited |
| Members | Delete | All archive | Gym archive | None | None | None |
| Members | Export | All | Gym | None | None | Own data future |
| Members | Approve | All | Overrides | None | None | None |
| Trainers | Read | All | Gym | Gym public/limited | Own | Public/assigned |
| Trainers | Create | All | Gym | None | None | None |
| Trainers | Update | All | Gym | None | Own profile limited | None |
| Trainers | Delete | All archive | Gym archive | None | None | None |
| Membership Plans | Read | All | Gym | Gym | Gym published | Published |
| Membership Plans | Create | All | Gym | None | None | None |
| Membership Plans | Update | All | Gym | None | None | None |
| Membership Plans | Delete | All archive | Gym archive | None | None | None |
| Membership Plans | Approve | All | Publish/archive | None | None | None |
| Memberships | Read | All | Gym | Gym limited | Assigned summary | Own |
| Memberships | Create | All | Gym | Gym limited | None | Own purchase/renewal |
| Memberships | Update | All | Gym | Renewal limited | None | None |
| Memberships | Delete | All cancel | Gym cancel | None | None | None |
| Memberships | Export | All | Gym | None | None | None |
| Payments | Read | All | Gym | Gym limited | None | Own |
| Payments | Create | All | Gym/offline | Offline limited | None | Own online payment |
| Payments | Update | All | Gym reconciliation | Offline notes limited | None | None |
| Payments | Delete | None hard delete | None hard delete | None | None | None |
| Payments | Export | All | Gym | None | None | None |
| Payments | Approve | All | Refunds/overrides | None | None | None |
| Attendance | Read | All | Gym | Gym | Assigned | Own |
| Attendance | Create | All | Gym | Gym | Assigned class | None |
| Attendance | Update | All | Gym correction | Correction limited | Assigned class limited | None |
| Attendance | Delete | Correct/archive | Correct/archive | None | None | None |
| Classes | Read | All | Gym | Gym | Assigned | Eligible published |
| Classes | Create | All | Gym | None | None unless delegated | None |
| Classes | Update | All | Gym | None | Assigned attendance only | Own booking only |
| Classes | Delete | All cancel | Gym cancel | None | None | Own booking cancel |
| Leads | Read | All | Gym | Gym | Assigned optional | Own submissions future |
| Leads | Create | All | Gym | Gym | None | Public forms |
| Leads | Update | All | Gym | Gym | Assigned notes optional | None |
| Leads | Delete | All archive | Gym archive | None | None | None |
| Leads | Export | All | Gym | None | None | None |
| Notifications | Read | All | Gym templates | Own/staff relevant | Own | Own |
| Notifications | Create | All | Gym | Operational limited | Assigned members | None |
| Notifications | Update | All | Gym templates | None | Own sent limited | Own read state |
| Reports | Read | All | Gym | Operational limited | Own workload | Own history |
| Reports | Export | All | Gym | None | None | None |
| Settings | Read | All | Gym | Limited | Own profile | Own preferences |
| Settings | Update | All | Gym | None | Own profile limited | Own preferences |
| Settings | Approve | All | Integration changes | None | None | None |
| Content | Read | All | Gym | Published/admin limited | Public | Published |
| Content | Create | All | Gym | None | None | None |
| Content | Update | All | Gym | None | None | None |
| Content | Delete | All archive | Gym archive | None | None | None |
| Content | Approve | All | Publish | None | None | None |
| Audit Logs | Read | All | Gym | None | None | None |
| Audit Logs | Export | All | Gym restricted | None | None | None |

## 5. Authorization Decision Inputs

Every privileged operation must consider:

- Authenticated user ID.
- User status.
- Role assignment.
- Gym scope.
- Resource gym ID.
- Resource owner/member ID.
- Trainer assignment.
- Requested action.
- Optional approval/override requirement.

## 6. Authorization Implementation Layers

| Layer | Responsibility |
| --- | --- |
| UI | Hide unavailable actions and show role-appropriate navigation. |
| Route layout | Gate role areas. |
| Server Action/Route Handler | Enforce permissions before mutation/read. |
| Service | Enforce business-specific authorization and ownership. |
| Repository | Scope queries by gym/user where applicable. |
| RLS | Final database access guard. |

## 7. Override and Approval Rules

Approval required for:

- Refunds.
- Membership cancellation.
- Payment status manual override.
- Attendance correction after configured window.
- Role changes.
- Staff invite.
- Content publication.
- Integration setting changes.
- Report exports containing personal or financial data.

Every approval/override must include:

- Actor.
- Permission.
- Entity.
- Reason.
- Timestamp.
- Audit log.

## 8. RBAC Testing Requirements

Test cases:

- Member cannot read another member's payments.
- Member cannot access admin route.
- Trainer cannot access unassigned member.
- Reception cannot refund payment.
- Reception cannot edit settings.
- Gym Admin cannot access another gym's data.
- Super Admin can access cross-gym data.
- Public guest can only read published content.
- Suspended user cannot access even with role.
- RLS blocks direct unauthorized table access.

