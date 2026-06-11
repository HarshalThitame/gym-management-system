# Member Role Design and Permission Architecture

## 1. Purpose

The Member role is the end-user fitness experience for the Gym Management SaaS Platform.

Members sit at the bottom of the operational hierarchy:

```text
Super Admin
  -> Organization Owner
    -> Gym Admin
      -> Reception Staff
      -> Trainer
      -> Member
```

A Member belongs to one gym and can access only their own profile, membership, attendance, workouts, nutrition plans, progress data, classes, appointments, payments, trainer communication, and documents.

The Member Portal must feel like a premium fitness app, not an admin dashboard. It should increase engagement, retention, habit formation, workout consistency, class participation, and fitness goal achievement while maintaining strict tenant isolation and personal data privacy.

## 2. Access Scope

Member can access:

| Scope | Access |
| --- | --- |
| Own profile | View and update personal profile fields |
| Own membership | View status, expiry, benefits, history, renewal options |
| Own attendance | View visits, streaks, calendar, consistency |
| Own workouts | View assigned plans and log workout completion |
| Own nutrition plans | View assigned meal plans and log nutrition |
| Own progress data | Goals, measurements, photos, milestones |
| Own appointments | View, book, cancel, and request changes |
| Own classes | Browse, book, cancel, join waitlist |
| Own payments | View history, invoices, receipts, outstanding dues |
| Own trainer communication | Chat and receive coaching messages |
| Own documents | View and download permitted documents |
| Own notifications | Read, dismiss, and manage preferences |

Member cannot access:

| Restricted Area | Reason |
| --- | --- |
| Other members | Privacy and data protection |
| Trainer private data | Role isolation |
| Staff data | Operational confidentiality |
| Other gyms | Gym isolation |
| Other organizations | Tenant isolation |
| Gym settings | Admin-only |
| Membership plan management | Gym Admin only |
| Revenue data | Management-only |
| Business reports | Admin-only |
| Administrative features | Role separation |
| Platform features | Super Admin only |

## 3. Permission Matrix

Actions:

- `R` = read
- `C` = create
- `U` = update
- `D` = delete
- `A` = book, request, or submit for approval
- `E` = export or download
- `P` = payment action

| Module | Read | Create | Update | Delete | Book or Request | Download | Payment | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Member Dashboard | R | - | - | - | - | - | - | Own data only |
| Profile Management | R | - | U own profile | No | - | - | - | Sensitive updates audited |
| Membership Management | R | - | Request freeze/upgrade | No | Renew/upgrade/freeze request | E own docs | P renewal | Cannot manage plans |
| Attendance Management | R | - | - | No | - | E own report | - | Own visits only |
| Workout Center | R | - | U completion/logs | Delete own draft only | - | E own plan | - | Assigned workouts only |
| Exercise Tracking | R | C logs | U own logs | Delete own draft only | - | E own history | - | Own workout sessions |
| Nutrition Center | R | C logs | U own logs | Delete own draft only | - | E own plan | - | Own meal entries |
| Body Measurements | R | C | U own entries | Delete own draft only | - | E own report | - | Own measurements |
| Progress Tracking | R | C notes/goals | U own goals | No hard delete | - | E own report | - | Own progress only |
| Progress Photos | R | C upload | U labels/notes | Delete own photo if policy allows | - | E own photos/report | - | Sensitive media |
| Class Bookings | R | C booking | U cancel status | Cancel own booking | Join waitlist | - | P if paid class | Own bookings only |
| Personal Training | R | - | Request reschedule | Cancel/request only | Book/request PT | E own notes/report | P if enabled | Assigned trainer/session only |
| Appointment Management | R | C request | U request/cancel | Cancel own appointment | Book consultation/assessment | - | - | Own appointments only |
| Communication Center | R | C messages/feedback | U preferences | Archive own thread if allowed | Support request | - | - | Own trainer/support communication |
| Payment Center | R | - | - | No | Pay dues/renew | E receipts/invoices | P | Own payments only |
| Document Center | R | - | - | No | - | E permitted docs | - | Own documents only |
| Rewards and Achievements | R | C challenge join | U own participation | Leave challenge if allowed | Join challenge | - | - | Public leaderboard opt-in |
| Fitness Challenges | R | C join | U own progress | Leave if allowed | Join challenge | - | - | Scope and privacy controlled |
| AI Fitness Coach | R | C prompts | U saved preferences | Delete own conversation if policy allows | Ask AI | - | - | Own context only |
| Member Analytics | R | - | - | No | - | E own report | - | Personal analytics only |
| Settings and Preferences | R | - | U own preferences | No | - | - | - | Account security controls |

## 4. Module Design

### Module 1: Member Dashboard

Dashboard widgets:

- Today's workout
- Today's nutrition plan
- Today's water goal
- Current weight
- Current fitness goal
- Workout streak
- Attendance streak
- Upcoming classes
- Upcoming PT sessions
- Membership status
- Membership expiry date
- Progress summary
- Recent achievements
- Announcements
- Trainer messages
- Quick actions

Design rules:

- Mobile-first and personalized.
- Prioritize today's action, not admin metrics.
- Use fitness-app language and visual hierarchy.
- Show next best action: start workout, log meal, book class, renew membership, message trainer.
- Avoid dense tables on mobile.
- Use cards, streaks, progress rings, timelines, and fitness summaries.

### Module 2: Profile Management

Allowed:

- View profile.
- Edit profile.
- Update profile photo.
- Update contact information.
- Manage emergency contacts.
- Manage medical information.
- Manage fitness preferences.
- Manage fitness goals.
- Manage communication preferences.
- Manage notification settings.

Rules:

- Member can update only their own profile.
- Email change may require verification.
- Phone change may require OTP or confirmation if configured.
- Medical information is sensitive and audited.
- Trainer and admin may see medical notes only if policy permits.

### Module 3: Membership Management

Allowed:

- View membership.
- View membership status.
- View membership expiry.
- Renew membership.
- Upgrade membership.
- Submit freeze request.
- View renewal history.
- View membership benefits.
- View membership documents.
- View membership invoices.

Restrictions:

- Cannot change plan pricing.
- Cannot activate own expired membership without approved renewal/payment.
- Cannot cancel/refund payment records.
- Cannot view other member memberships.

Rules:

- Renewal uses current gym plans.
- Freeze request may require Gym Admin approval.
- Upgrade should show prorated estimate if billing supports it.
- Membership documents and invoices are own-member only.

### Module 4: Attendance Management

Allowed:

- View attendance history.
- View visit history.
- View attendance calendar.
- View attendance analytics.
- Track workout consistency.
- View attendance streaks.
- View attendance milestones.

Rules:

- Member can view only their own attendance.
- Check-in creation may happen through QR, reception, device, or member app if enabled.
- Attendance correction requests should be submitted to reception or Gym Admin.
- Streaks are calculated from verified attendance records.

### Module 5: Workout Center

Allowed:

- View assigned workout plans.
- View today's workout.
- View workout schedule.
- View exercise library.
- View exercise instructions.
- View exercise videos.
- Track workout progress.
- Mark workout completion.
- View workout history.
- Add workout notes.
- Receive workout reminders.

Rules:

- Assigned plans are read-only except logging/completion fields.
- Member can log actual sets, reps, weight, duration, and notes.
- Trainer-authored instructions cannot be edited by member.
- Offline workout drafts can sync when online.

### Module 6: Exercise Tracking

Allowed:

- Log sets.
- Log reps.
- Log weight.
- Log duration.
- Log distance.
- Add workout notes.
- Add workout ratings.
- Track personal records.
- View exercise progress graphs.

Rules:

- Logs belong to the member.
- Personal records are derived from member logs.
- Member can edit recent draft/log entries according to policy.
- Historical changes should preserve audit trail if used for coaching analytics.

### Module 7: Nutrition Center

Allowed:

- View assigned meal plans.
- View daily nutrition goals.
- View calorie targets.
- View macro targets.
- Track meals.
- Track water intake.
- Track supplements.
- Track nutrition compliance.
- View meal history.

Rules:

- Assigned meal plan instructions are trainer-authored and read-only.
- Member meal logs are member-owned.
- Nutrition data is sensitive health data.
- Water tracking should be quick-entry mobile friendly.
- Supplement tracking must avoid unsupported medical claims.

### Module 8: Body Measurements

Allowed:

- Weight tracking.
- BMI tracking.
- Body fat tracking.
- Muscle mass tracking.
- Circumference tracking.
- Measurement history.
- Progress charts.
- Goal tracking.

Rules:

- Measurements belong to member.
- BMI and derived values should be computed consistently.
- Member can add entries manually unless gym policy requires trainer validation.
- Measurement history should not be hard deleted.

### Module 9: Progress Tracking

Allowed:

- Fitness goals.
- Weight goals.
- Strength goals.
- Muscle gain goals.
- Fat loss goals.
- Progress graphs.
- Milestones.
- Achievements.
- Transformation tracking.

Rules:

- Goals are member-owned and trainer-visible when assigned.
- Goal completion can create achievements.
- Progress should combine workouts, nutrition, attendance, measurements, and class participation.
- Member analytics should not expose other members.

### Module 10: Progress Photos

Allowed:

- Upload progress photos.
- View photo timeline.
- Before/after comparison.
- Transformation gallery.
- Progress reports.

Rules:

- Photos are private by default.
- Member controls visibility where product policy allows.
- Trainer can view only assigned member photos if consent/policy allows.
- Images must be stored in private, scoped storage.
- Deletion or hiding should follow retention policy.

### Module 11: Class Bookings

Allowed:

- Browse classes.
- Book classes.
- Cancel booking.
- Join waitlist.
- View schedule.
- View class history.
- Receive class reminders.
- Track class attendance.

Rules:

- Member can book only eligible classes in their gym.
- Capacity controls prevent overbooking.
- Cancellation window applies.
- Waitlist position is visible.
- Paid classes require successful payment before confirmation if configured.

### Module 12: Personal Training

Allowed:

- View assigned trainer.
- Schedule PT sessions if package/approval allows.
- Submit reschedule requests.
- View session history.
- View PT notes shared by trainer.
- Submit trainer feedback.
- Track PT progress.

Restrictions:

- Cannot assign own trainer.
- Cannot mark sessions completed.
- Cannot access trainer private notes unless shared.
- Cannot view PT package financial internals beyond own purchase/payment status.

Rules:

- PT booking requires active PT package or approval.
- Reschedule/cancel rules follow gym policy.
- Feedback is tied to own session/trainer.

### Module 13: Appointment Management

Allowed:

- Book consultation.
- Book assessment.
- Schedule trainer meetings.
- View appointments.
- Cancel appointments.
- Receive appointment reminders.

Rules:

- Appointment must belong to member and gym.
- Trainer meeting must use assigned trainer or approved trainer.
- Cancellation reason may be required.
- Appointment history is retained.

### Module 14: Communication Center

Allowed:

- Chat with trainer.
- Receive notifications.
- Receive announcements.
- Create support requests.
- Submit feedback.
- In-app messaging.
- Push notifications.
- Email notifications.

Rules:

- Member can message assigned trainer and permitted support channels.
- Member cannot message other members unless community features are explicitly enabled.
- Communication preferences and opt-outs must be respected.
- Communication history is stored.

### Module 15: Payment Center

Allowed:

- View payment history.
- Download receipts.
- Download invoices.
- Renew membership.
- Make online payments.
- View subscription status.
- View outstanding dues.
- Receive payment reminders.

Restrictions:

- Cannot pay for other members unless family account feature exists.
- Cannot edit invoices.
- Cannot refund payments.
- Cannot delete payment history.

Rules:

- Payment verification happens server-side.
- Receipts and invoices are scoped to member.
- Outstanding dues should be clear and actionable.

### Module 16: Document Center

Allowed:

- Membership agreements.
- Invoices.
- Receipts.
- Assessment reports.
- Progress reports.
- Nutrition reports.
- Workout reports.
- Download documents.

Rules:

- Member can access only their own documents.
- Sensitive documents require secure storage.
- Document downloads can be logged.
- Admin-only internal documents are hidden.

### Module 17: Rewards and Achievements

Allowed:

- Workout streaks.
- Attendance streaks.
- Milestones.
- Badges.
- Achievement unlocks.
- Leaderboard participation.
- Challenge participation.
- Reward points.

Rules:

- Leaderboard participation should be opt-in if personal data is visible.
- Rewards are derived from verified activity.
- Achievements should not expose private health metrics without consent.

### Module 18: Fitness Challenges

Allowed:

- Weight loss challenges.
- Transformation challenges.
- Attendance challenges.
- Strength challenges.
- Custom gym challenges.
- Challenge rankings.
- Challenge rewards.

Rules:

- Challenge availability is gym-scoped.
- Member can join eligible challenges.
- Challenge ranking privacy must be configurable.
- Challenge progress must be based on verified or approved data.

### Module 19: AI Fitness Coach

Allowed:

- AI workout guidance.
- AI exercise recommendations.
- AI nutrition guidance.
- AI progress insights.
- AI goal recommendations.
- AI motivation messages.
- AI recovery suggestions.
- AI fitness Q&A.

Rules:

- AI uses only member's own data and approved gym knowledge base.
- AI should not expose other member, trainer, staff, payment, or tenant data.
- AI nutrition and workout advice must include safety boundaries.
- High-risk medical or injury advice should route to trainer or professional guidance.
- Trainer-approved plans take priority over AI suggestions.

### Module 20: Member Analytics

Allowed analytics:

- Attendance analytics.
- Workout analytics.
- Nutrition analytics.
- Progress analytics.
- Goal achievement analytics.
- Consistency analytics.
- Performance trends.

Rules:

- Analytics are personal only.
- Trends should be explainable and based on source data.
- No comparison with identifiable members unless opt-in leaderboard/challenge is enabled.

### Module 21: Settings and Preferences

Allowed:

- Notification preferences.
- Theme preferences.
- Privacy settings.
- Language settings.
- Communication preferences.
- Account security.
- Password change.
- MFA settings.

Rules:

- Security-sensitive changes require re-authentication where appropriate.
- Notification preferences must be honored by communication workflows.
- Privacy settings affect profile visibility, progress photos, and challenge display.

## 5. Mobile App Navigation Structure

Recommended bottom navigation:

```text
Home
Workout
Nutrition
Classes
Progress
```

Recommended More menu:

```text
Membership
Payments
Attendance
Trainer Chat
Appointments
Documents
Achievements
AI Coach
Settings
Support
```

Recommended routes:

| Route | Purpose |
| --- | --- |
| `/member` | Personalized dashboard |
| `/member/profile` | Profile and health preferences |
| `/member/membership` | Membership status and renewal |
| `/member/attendance` | Visit history and streaks |
| `/member/workouts` | Workout plans and logging |
| `/member/workouts/[sessionId]` | Active workout tracking |
| `/member/nutrition` | Meal plans and nutrition logging |
| `/member/progress` | Measurements, goals, analytics |
| `/member/photos` | Progress photo timeline |
| `/member/classes` | Class schedule and bookings |
| `/member/pt` | Trainer and PT sessions |
| `/member/appointments` | Consultations and assessments |
| `/member/notifications` | Messages and announcements |
| `/member/payments` | Payments, invoices, receipts |
| `/member/documents` | Own documents and reports |
| `/member/rewards` | Achievements and challenges |
| `/member/ai-coach` | AI fitness coach |
| `/member/settings` | Preferences and security |

## 6. Member Dashboard Layout

Mobile-first layout:

```text
Top
  Greeting
  Membership badge
  Notification icon

Primary Action Card
  Today's workout or next best action
  Start button

Daily Goals
  Water
  Calories
  Steps/attendance if enabled
  Workout completion

Progress Snapshot
  Current weight
  Goal progress
  Streaks

Schedule
  Upcoming class
  Upcoming PT session
  Appointment reminder

Engagement
  Trainer message
  Recent achievement
  Announcement

Quick Actions
  Log workout
  Log meal
  Book class
  Pay dues
  Chat trainer
```

Desktop layout:

- Wider dashboard grid.
- Progress charts visible without extra taps.
- Workout and nutrition panels side by side.
- Payments and membership summary in secondary column.

## 7. Workout Tracking Workflow

```text
Open Workout
  -> View today's assigned workout
  -> Start workout
  -> Mark exercise complete
  -> Log sets, reps, weight, duration, distance
  -> Add notes and rating
  -> Complete workout
  -> Update streak and compliance
  -> Notify trainer if configured
  -> Save history and progress metrics
```

Validation:

- Workout must belong to member.
- Assigned workout instructions are read-only.
- Logs are member-owned.
- Offline draft can sync when online.

## 8. Nutrition Tracking Workflow

```text
Open Nutrition
  -> View assigned meal plan
  -> Review calorie and macro targets
  -> Log meals
  -> Log water intake
  -> Log supplements if enabled
  -> Review daily compliance
  -> Submit notes/questions to trainer
  -> Save nutrition history
```

Validation:

- Meal plan must belong to member.
- Calories/macros should be computed consistently.
- Member can edit recent logs according to policy.
- Allergies and medical notes should be visible as warnings where relevant.

## 9. Progress Tracking Workflow

```text
Open Progress
  -> View current goal
  -> Add measurement
  -> Upload progress photo if desired
  -> Review charts
  -> View milestones and achievements
  -> Generate or view progress report
  -> Share update with trainer if enabled
```

Validation:

- Progress data must belong to member.
- Photos require consent/privacy rules.
- Historical progress should not be hard deleted.
- Derived metrics should be calculated server-side.

## 10. Class Booking Workflow

```text
Browse Classes
  -> Filter by date, category, trainer, availability
  -> Open class details
  -> Check eligibility
  -> Book class
  -> If full, join waitlist
  -> Receive confirmation
  -> Receive reminder
  -> Attend class
  -> Attendance is recorded
```

Rules:

- Member must be eligible based on membership/access rules.
- Class must belong to member's gym.
- Capacity is enforced.
- Cancellation window is enforced.
- Waitlist promotions are automated and notified.

## 11. PT Session Workflow

```text
Open PT
  -> View assigned trainer
  -> View active PT package
  -> Request or book session
  -> Receive confirmation
  -> Attend session
  -> View shared trainer notes
  -> Submit feedback
  -> Track PT progress
```

Rules:

- Active PT package or approval required.
- Session must be with assigned or approved trainer.
- Member can request reschedule or cancellation according to policy.
- Completed session is marked by trainer or staff.

## 12. AI Coach Architecture

AI Coach components:

```text
Member AI UI
  -> Safety and intent classifier
  -> Member context builder
  -> Retrieval from approved knowledge base
  -> AI response generator
  -> Output validation
  -> Conversation history
  -> Trainer escalation when needed
```

Allowed AI context:

- Member goals.
- Assigned workout plans.
- Assigned nutrition plans.
- Attendance summary.
- Workout history.
- Measurement trends.
- Class participation.
- Trainer-approved guidance.
- Gym FAQs and policies.

Forbidden AI context:

- Other members.
- Staff data.
- Trainer private notes not shared with member.
- Payment internals beyond member's own dues/status.
- Organization revenue.
- System prompts.
- Platform configuration.

AI safety rules:

- Do not diagnose medical conditions.
- Escalate injury, pain, pregnancy, chronic disease, eating disorder, or extreme diet advice to trainer/professional.
- Explain recommendations using member-owned data.
- Clearly distinguish AI suggestions from trainer-assigned plans.
- Trainer-assigned plan remains source of truth.

## 13. Security Model

Mandatory rules:

1. Member can access only own records.
2. Member cannot access other members.
3. Member cannot access trainer private data.
4. Member cannot access staff, revenue, reports, or admin features.
5. Every mutation validates `user_id` or `member_id` server-side.
6. Profile updates are audited when sensitive.
7. Payment actions are tracked.
8. Communication history is stored.
9. Progress photos and health data are protected.
10. AI context is member-only.
11. Downloads are scoped to own documents.
12. Public leaderboard/challenge display requires explicit privacy policy and opt-in if identifiable.

Sensitive actions:

- Update medical information.
- Update emergency contact.
- Upload progress photo.
- Delete/hide progress photo.
- Make payment.
- Request freeze.
- Cancel class/PT session.
- Change password.
- Enable/disable MFA.
- Change communication preferences.

## 14. Database Access Rules

Member queries must validate record ownership.

Core predicates:

```text
member.user_id = auth.uid()
record.member_id = current_member_id()
record.gym_id = current_member_gym_id()
```

Required table rules:

| Table | Access Rule |
| --- | --- |
| `members` | member can read/update own row |
| `profiles` | user can read/update own profile |
| `memberships` | read own membership records |
| `membership_plans` | read plans available to own gym/member |
| `payments` | read/pay own payment records |
| `invoices` | read/download own invoices |
| `attendance_sessions` | read own attendance |
| `attendance_logs` | read own relevant visit logs if exposed |
| `class_sessions` | read eligible own-gym sessions |
| `class_bookings` | read/create/update own bookings |
| `class_waitlists` | read/create/update own waitlist entries |
| `trainer_assignments` | read own assigned trainer relationship |
| `trainer_sessions` | read own PT sessions |
| `workout_program_assignments` | read own assigned programs |
| `workout_sessions` | read/create/update own workout logs |
| `exercise_logs` | read/create/update own exercise logs |
| `nutrition_plans` | read own assigned plans |
| `meal_entries` | read/create/update own meal logs |
| `body_measurements` | read/create/update own measurements |
| `progress_photos` | read/create/update own photos |
| `fitness_goals` | read/create/update own goals |
| `notifications` | read/update own notifications |
| `communication_history` | read own communication records |
| `member_documents` | read/download own documents |
| `audit_logs` | insert own actions; read own actor logs where exposed |

RLS pattern:

```text
Allow SELECT when:
  user has member role
  and record belongs to current_member_id()

Allow INSERT when:
  user has member role
  and new.member_id = current_member_id()
  and new.gym_id = current_member_gym_id()

Allow UPDATE when:
  user has member role
  and old.member_id = current_member_id()
  and new.member_id = current_member_id()
  and new.gym_id = current_member_gym_id()

Allow DELETE:
  deny by default
  allow soft-delete/hide for own draft logs or photos only where policy permits
```

Forbidden:

```text
Member can query all members
Member can query another member by ID
Member can update membership status
Member can edit payments or invoices
Member can view admin reports
Member can see trainer private notes
Member can access other gym records
Member can change gym_id
Member can access SaaS platform data
```

## 15. UI Requirements

Member portal must feel like a premium fitness application:

- Mobile-first layout.
- Large touch targets.
- Smooth, restrained animations.
- Personalized dashboard.
- Fitness-focused visual language.
- Fast loading and low hydration cost.
- Offline-friendly workout and nutrition drafts where possible.
- Clear streaks, goals, and achievements.
- Strong empty states that guide the next action.
- Accessible contrast, focus states, labels, and screen reader support.
- PWA install prompts and push notification opt-in.

Recommended quick actions:

- Start Workout
- Log Meal
- Add Water
- Book Class
- Chat Trainer
- Add Weight
- Upload Photo
- Pay Dues

## 16. Acceptance Criteria

Member role is complete when:

- Member can access `/member`.
- Member cannot access `/trainer`, `/admin`, `/organization`, or `/super-admin`.
- Member sees only own profile, membership, payments, attendance, workouts, nutrition, and progress.
- Direct URL access to another member's data fails.
- Member can log workouts and nutrition.
- Member can book eligible own-gym classes.
- Member can view and download own invoices/receipts.
- Member cannot edit membership status or payment records.
- Member communications are limited to assigned trainer/support channels.
- Progress photos and health data are private and scoped.
- AI Coach uses only member-owned context.
- All sensitive actions are audited.
