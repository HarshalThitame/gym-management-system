# Trainer Role Design and Permission Architecture

## 1. Purpose

The Trainer role is responsible for improving member fitness outcomes inside one assigned gym.

They sit below Gym Admin and Reception Staff in operational scope:

```text
Super Admin
  -> Organization Owner
    -> Gym Admin
      -> Reception Staff
      -> Trainer
      -> Member
```

A Trainer can only access members, PT clients, classes, workouts, nutrition plans, appointments, assessments, progress records, and communications assigned to them. They must not access revenue, payments, membership pricing, staff management, gym settings, organization settings, platform settings, other gyms, or another trainer's clients.

## 2. Access Scope

Trainer can access:

| Scope | Access |
| --- | --- |
| Assigned gym | Read own trainer context only |
| Assigned members | Fitness and coaching access |
| Assigned PT clients | PT scheduling, notes, completion tracking |
| Assigned classes | Attendance and class notes |
| Assigned appointments | Calendar and session management |
| Assigned workout programs | Create, edit, assign, review |
| Assigned nutrition plans | Create, edit, assign, review |
| Assigned progress reports | Measurements, photos, milestones, compliance |
| Assigned communications | Message assigned members only |
| Own activity logs | Own actions and session history |

Trainer cannot access:

| Restricted Area | Reason |
| --- | --- |
| Other trainers' members | Privacy and ownership |
| Other gyms | Gym isolation |
| Other organizations | Tenant isolation |
| Revenue data | Management-only visibility |
| Payment data | Reception/Gym Admin only |
| Membership pricing | Gym Admin only |
| Staff management | Gym Admin only |
| Gym settings | Gym Admin only |
| Organization settings | Organization Owner only |
| Platform settings | Super Admin only |
| SaaS platform data | Super Admin only |

## 3. Permission Matrix

Actions:

- `R` = read
- `C` = create
- `U` = update
- `D` = delete
- `A` = assign or approve within trainer scope
- `E` = export

| Module | Read | Create | Update | Delete | Assign | Export | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Trainer Dashboard | R | - | - | - | - | - | Assigned trainer data only |
| Member Management | R assigned only | - | Limited fitness notes | No | - | - | Membership status read-only |
| Client Assessment | R | C | U own assessments | Archive own drafts only | - | E reports | Assigned members only |
| Workout Programs | R | C | U own/assigned | Archive templates only | A assigned members | E plans | No other trainers' plans unless shared |
| Exercise Management | R | C custom | U own custom | Archive own custom | - | - | Shared exercise library read-only |
| Personal Training | R | C sessions | U sessions | Cancel sessions | A own PT clients | E reports | Assigned PT clients only |
| Nutrition Management | R | C | U own/assigned | Archive templates only | A assigned members | E plans | Assigned members only |
| Body Measurements | R | C | U own entries | No hard delete | - | E reports | Assigned members only |
| Progress Tracking | R | C notes | U own notes/goals | No hard delete | - | E reports | Assigned members only |
| Progress Photos | R | C upload | U labels/notes | Delete own draft only | - | E reports | Sensitive media controls |
| Class Management | R assigned | C attendance notes | U attendance/class notes | No | Start/end assigned class | E class report | Assigned classes only |
| Appointment Management | R | C | U | Cancel own appointments | A assigned clients | - | Own calendar only |
| Communication Center | R own threads | C messages | U own drafts | Archive own messages if allowed | Send assigned members | - | No bulk campaigns |
| AI Fitness Assistant | R | C prompts | U saved suggestions | No | Suggest with approval | - | Assigned client context only |
| Trainer Analytics | R own | - | - | - | - | E own reports | No gym-wide analytics |
| Document Center | R own reports | C reports | U own reports | Archive own drafts | - | E PDF | Assigned member reports |
| Task Management | R | C own tasks | U completion | No | - | - | Own tasks only |
| Limited Audit Logs | R own | - | - | No | - | - | Own actions only |

## 4. Module Design

### Module 1: Trainer Dashboard

Dashboard widgets:

- Today's sessions
- Upcoming sessions
- Assigned members
- Active PT clients
- New client assignments
- Workout compliance rate
- Nutrition compliance rate
- Progress alerts
- Pending assessments
- Client milestones
- Client achievements
- Recent messages
- Quick actions

Dashboard rules:

- Data is filtered by trainer identity and assigned gym.
- Widgets focus on coaching tasks, not financial management.
- High-priority alerts should highlight missed workouts, stalled progress, injury notes, and pending assessments.
- Quick actions should support session logging, workout assignment, assessment entry, and messaging.

### Module 2: Member Management

Allowed:

- View assigned members.
- View member profiles.
- View fitness history.
- View medical notes.
- View injury notes.
- View attendance summary.
- View membership status read-only.
- View progress photos.
- View measurements.
- Search assigned members.

Restrictions:

- Cannot view unassigned members.
- Cannot delete members.
- Cannot change membership status.
- Cannot view payment history or financial data.
- Cannot edit member identity or contact data except allowed coaching notes.

### Module 3: Client Assessment

Allowed:

- Create assessment.
- Initial fitness assessment.
- Body composition assessment.
- Mobility assessment.
- Strength assessment.
- Cardio assessment.
- Flexibility assessment.
- Goal assessment.
- View assessment history.
- Generate assessment reports.

Rules:

- Assessment must belong to assigned member and same gym.
- Assessment edits must be audited.
- Medical or injury fields are sensitive and require access logging.
- Assessment history is append-first; avoid overwriting old results.

### Module 4: Workout Program Management

Allowed:

- Create workout plans.
- Edit workout plans.
- Assign workout plans.
- Duplicate workout plans.
- Use workout templates.
- Use exercise library.
- Manage workout categories.
- Create beginner, intermediate, and advanced programs.
- Create weight loss, muscle gain, strength, and sports performance programs.

Rules:

- Trainer can assign workouts only to assigned members.
- Shared templates may be read-only unless trainer owns them.
- Program assignment must record trainer, member, start date, and goal.
- Workout changes should preserve assignment history.

### Module 5: Exercise Management

Allowed:

- View exercise library.
- View exercise instructions.
- View exercise videos.
- View exercise categories.
- View exercise alternatives.
- View exercise progressions.
- View exercise regressions.
- Create custom exercises.
- Add exercise notes.

Rules:

- Global exercise library is read-only.
- Trainer-created exercises are scoped to gym or trainer depending on sharing settings.
- Exercise media must be approved or validated before public reuse.

### Module 6: Personal Training Management

Allowed:

- Manage PT clients.
- Schedule PT sessions.
- Reschedule sessions.
- Cancel sessions.
- Track session completion.
- Add PT session notes.
- View session history.
- Generate PT progress reports.
- Track PT goals.

Restrictions:

- Cannot sell PT packages.
- Cannot collect PT payments.
- Cannot issue refunds.
- Cannot access PT revenue except optional own performance summary if management allows.

Rules:

- Session must belong to assigned trainer and assigned member.
- Completed sessions update package usage.
- Cancellation reason is required.
- Session notes are private to trainer/admin unless shared.

### Module 7: Nutrition Management

Allowed:

- Create meal plans.
- Assign meal plans.
- Edit meal plans.
- Use nutrition templates.
- Set calorie targets.
- Set macro targets.
- Set hydration targets.
- Add supplement recommendations.
- Track meal compliance.
- Generate nutrition reports.

Rules:

- Trainer can manage nutrition only for assigned members.
- Nutrition recommendations should include disclaimer and human review.
- Supplement recommendations must avoid medical claims.
- Member food logs remain sensitive health data.

### Module 8: Body Measurement Tracking

Allowed:

- Weight tracking.
- Body fat tracking.
- BMI tracking.
- Muscle mass tracking.
- Circumference measurements.
- Progress graphs.
- Measurement history.
- Measurement reports.

Rules:

- Measurements must belong to assigned member.
- Historical measurements should not be hard deleted.
- BMI and derived metrics should be recalculated server-side.
- Measurement changes are audited.

### Module 9: Progress Tracking

Allowed:

- Manage fitness goals.
- Track goal progress.
- Track workout progress.
- Track strength progress.
- Track weight progress.
- Track transformations.
- Track milestones.
- View progress analytics.

Rules:

- Trainer sees assigned member progress only.
- Goal completion should create milestone events.
- Progress insights must be based on source logs and measurements.

### Module 10: Progress Photos

Allowed:

- Upload photos.
- Compare photos.
- View transformation timeline.
- Before/after comparison.
- Generate progress reports.
- View photo history.

Rules:

- Progress photos are sensitive.
- Access must be limited to assigned trainer, member, and authorized admin.
- Photos must be stored in scoped private storage.
- Every view/download can be logged if privacy policy requires it.

### Module 11: Class Management

Allowed:

- View assigned classes.
- Manage class attendance.
- Start class.
- End class.
- Record attendance.
- Add class notes.
- View class performance reports.

Rules:

- Trainer can manage only assigned classes.
- Attendance records must belong to same gym.
- Trainer cannot change class pricing or capacity unless delegated.
- Class cancellation may require Gym Admin approval.

### Module 12: Appointment Management

Allowed:

- Schedule appointments.
- Manage calendar.
- Manage availability.
- Send session reminders.
- Manage client appointments.
- Manage consultation appointments.
- Manage follow-up appointments.

Rules:

- Trainer can manage own availability only.
- Appointment member must be assigned or consultation-approved.
- Overlapping appointments should be prevented.

### Module 13: Communication Center

Allowed:

- Chat with assigned members.
- Send workout reminders.
- Send nutrition reminders.
- Send motivational messages.
- Send session reminders.
- Send progress follow-ups.
- Push notifications.
- In-app messaging.

Restrictions:

- Cannot run bulk gym campaigns.
- Cannot message unassigned members.
- Cannot override member notification preferences.

Rules:

- Communication history must be stored.
- Messages should be gym and trainer scoped.
- Sensitive advice should avoid medical claims.

### Module 14: AI Fitness Assistant

Allowed:

- AI workout recommendations.
- AI exercise suggestions.
- AI nutrition suggestions.
- AI progress insights.
- AI goal recommendations.
- AI compliance alerts.
- AI client risk detection.

Rules:

- AI context must be limited to assigned members.
- AI output must be reviewed by trainer before assignment.
- AI should cite or explain the source data used.
- Prompt and response events should be logged for observability.
- AI must not expose payment, revenue, or other members' data.

### Module 15: Trainer Analytics

Allowed analytics:

- Assigned members count.
- Workout compliance.
- Nutrition compliance.
- Session completion rate.
- Client retention.
- Goal achievement rate.
- Transformation success rate.
- Trainer performance dashboard.

Restrictions:

- Cannot view gym-wide revenue analytics.
- Cannot compare private data from other trainers unless management enables aggregate anonymized benchmarks.

### Module 16: Document Center

Allowed:

- Assessment reports.
- Fitness reports.
- Nutrition reports.
- Progress reports.
- Transformation reports.
- Export PDF reports.

Rules:

- Reports are limited to assigned members.
- Exports must be logged.
- Reports containing sensitive health data should be private by default.

### Module 17: Task Management

Allowed:

- Pending assessments.
- Pending workout reviews.
- Pending nutrition reviews.
- Upcoming sessions.
- Client follow-ups.
- Goal reviews.
- Task completion tracking.

Rules:

- Tasks are trainer-scoped.
- Overdue tasks should appear on dashboard.
- Completion notes are auditable.

### Module 18: Limited Audit Logs

Allowed:

- View own activity.
- View own session history.
- View own client actions.

Restricted:

- Cannot view system logs.
- Cannot view other trainers' audit records.
- Cannot delete logs.

## 5. Sidebar Navigation Structure

Recommended sidebar:

```text
Coach Workspace
  Dashboard
  My Members
  PT Sessions
  Calendar

Programs
  Workout Plans
  Exercise Library
  Nutrition Plans

Progress
  Assessments
  Measurements
  Progress Photos
  Goals
  Milestones

Classes
  My Classes
  Class Attendance

Engagement
  Messages
  Tasks
  AI Assistant

Reports
  Trainer Analytics
  Documents
  My Activity
```

Recommended routes:

| Route | Purpose |
| --- | --- |
| `/trainer` | Trainer dashboard |
| `/trainer/members` | Assigned members |
| `/trainer/members/[memberId]` | Assigned member coaching profile |
| `/trainer/sessions` | PT sessions |
| `/trainer/calendar` | Calendar and availability |
| `/trainer/programs` | Workout plans |
| `/trainer/exercises` | Exercise library |
| `/trainer/nutrition` | Nutrition plans |
| `/trainer/assessments` | Assessments |
| `/trainer/progress` | Progress tracking |
| `/trainer/photos` | Progress photos |
| `/trainer/classes` | Assigned classes |
| `/trainer/communications` | Member messaging |
| `/trainer/tasks` | Coaching tasks |
| `/trainer/ai` | AI fitness assistant |
| `/trainer/reports` | Trainer analytics and documents |
| `/trainer/activity` | Own audit/activity |

## 6. Trainer Dashboard Layout

Desktop layout:

```text
Header
  Trainer name
  Today date
  Availability status
  Quick actions

Row 1: Today
  Today's Sessions
  Upcoming Sessions
  Pending Assessments
  Progress Alerts

Row 2: Client Health
  Assigned Members
  Active PT Clients
  Workout Compliance
  Nutrition Compliance

Row 3: Coaching Charts
  Session Completion Trend
  Workout Compliance Trend
  Client Progress Trend

Row 4: Work Queues
  New Assignments
  Follow-Ups Due
  Goal Reviews
  Recent Messages

Row 5: Recognition
  Client Milestones
  Achievements
  Transformation Highlights
```

Mobile layout:

- Today-first dashboard.
- Bottom navigation: Dashboard, Members, Sessions, Programs, More.
- Large session logging button.
- Fast assigned-member search.
- Swipe-friendly member cards.
- One-tap workout assignment and session completion.

## 7. Workout Management Workflow

```text
Open Assigned Member
  -> Review goal, history, injuries, compliance
  -> Choose template or create plan
  -> Add exercises, sets, reps, rest, instructions
  -> Set schedule and progression
  -> Assign plan
  -> Notify member
  -> Track compliance
  -> Adjust program based on progress
```

Validation:

- Member must be assigned to trainer.
- Workout plan must belong to same gym.
- Exercise prescription should respect injury notes.
- Assignment creates audit and notification records.

## 8. Nutrition Management Workflow

```text
Open Assigned Member
  -> Review goal and measurements
  -> Set calorie and macro targets
  -> Choose nutrition template or create custom plan
  -> Add meals, hydration, supplement notes
  -> Assign plan
  -> Notify member
  -> Review compliance
  -> Adjust plan based on progress
```

Validation:

- Member must be assigned to trainer.
- Nutrition plan must be same gym and trainer-scoped.
- Medical conditions should trigger caution/escalation notes.
- Member preferences and allergies should be respected.

## 9. PT Session Workflow

```text
Open PT Sessions
  -> Schedule session
  -> Validate trainer availability
  -> Validate member assignment
  -> Conduct session
  -> Mark completed, missed, or cancelled
  -> Add session notes
  -> Update PT package usage
  -> Notify member
  -> Audit session action
```

Session statuses:

- Scheduled
- Completed
- Missed
- Cancelled
- Rescheduled

Rules:

- Trainer can update own sessions only.
- Completion updates package usage.
- Cancellation requires reason.
- Missed sessions can trigger follow-up task.

## 10. Progress Tracking Workflow

```text
Open Assigned Member
  -> Review current goal
  -> Add measurements
  -> Upload progress photos if allowed
  -> Review workout/nutrition compliance
  -> Record progress notes
  -> Mark milestones
  -> Generate progress report
  -> Share with member if approved
```

Rules:

- All progress data is assigned-member scoped.
- Photos require consent and privacy controls.
- Reports with sensitive data are private by default.
- Milestone creation should notify the member.

## 11. Client Assessment Workflow

```text
Start Assessment
  -> Select assigned member
  -> Choose assessment type
  -> Record baseline data
  -> Add mobility/strength/cardio/flexibility scores
  -> Add injury and limitation notes
  -> Define goals
  -> Save assessment
  -> Generate report
  -> Create workout/nutrition follow-up tasks
```

Assessment types:

- Initial fitness
- Body composition
- Mobility
- Strength
- Cardio
- Flexibility
- Goal review

Rules:

- Assessment edits are audited.
- Historical assessments are preserved.
- Injury notes are sensitive and access controlled.

## 12. Security Model

Mandatory rules:

1. Trainer can only access assigned members.
2. Trainer can only access assigned classes.
3. Trainer can only access own PT sessions and appointments.
4. Trainer cannot access other gyms or organizations.
5. Trainer cannot access payment or revenue records.
6. Trainer cannot manage memberships or pricing.
7. Trainer cannot delete members.
8. Trainer cannot manage staff or settings.
9. Every trainer action is logged.
10. Assessment changes are audited.
11. Progress reports are tracked.
12. Communication history is stored.
13. AI context is limited to assigned clients.
14. Progress photos and health data are protected.

Sensitive actions:

- Add/edit medical notes.
- Add/edit injury notes.
- Upload progress photos.
- Generate progress reports.
- Assign workout plan.
- Assign nutrition plan.
- Complete or cancel PT session.
- Send coaching recommendation.

## 13. Database Access Rules

Trainer queries must validate trainer ownership and gym scope.

Core predicates:

```text
trainer.user_id = auth.uid()
trainer.gym_id = target.gym_id
member is assigned to trainer
class is assigned to trainer
session.trainer_id = trainer.id
```

Required table rules:

| Table | Access Rule |
| --- | --- |
| `trainers` | trainer can read own trainer row |
| `trainer_profiles` | trainer can read/update own profile fields |
| `trainer_assignments` | read active assignments where `trainer_id = current_trainer_id()` |
| `members` | read assigned members only |
| `memberships` | read assigned member membership status only |
| `attendance_sessions` | read assigned member attendance summary only |
| `fitness_goals` | read/create/update assigned member goals |
| `workout_programs` | read/create/update own programs and assigned member programs |
| `workout_program_assignments` | create/update where trainer and member assignment match |
| `workout_sessions` | read assigned member sessions |
| `exercise_logs` | read assigned member logs |
| `body_measurements` | read/create/update assigned member measurements |
| `progress_photos` | read/create assigned member photos with consent |
| `nutrition_plans` | read/create/update assigned member plans |
| `meal_plans` | read/create/update assigned member meal plans |
| `trainer_sessions` | read/create/update own sessions |
| `class_sessions` | read assigned class sessions |
| `class_attendance` | update attendance for assigned classes |
| `notifications` | create messages to assigned members only |
| `audit_logs` | insert actions; read own actor logs only |

RLS pattern:

```text
Allow SELECT when:
  user has trainer role
  and record belongs to trainer's gym
  and record is assigned to current trainer

Allow INSERT when:
  user has trainer role
  and new record belongs to trainer's gym
  and member/class/session is assigned to current trainer

Allow UPDATE when:
  user has trainer role
  and old record belongs to trainer's assigned scope
  and new record remains inside trainer's assigned scope

Allow DELETE:
  deny by default
  allow archive/cancel status transitions where business rules permit
```

Forbidden:

```text
Trainer can query all members in gym
Trainer can query another trainer's members
Trainer can view payments
Trainer can edit memberships
Trainer can assign themselves members
Trainer can change gym_id
Trainer can access other gym records
Trainer can delete health/progress history
```

## 14. UI Requirements

Trainer UI must be mobile-first and coaching-focused:

- Fast assigned-client search.
- Today's sessions first.
- One-click workout assignment.
- One-click session logging.
- Quick assessment entry.
- Simple measurement entry.
- Progress photo timeline.
- Clear compliance indicators.
- Injury and medical note warnings.
- Offline-friendly workout/session note drafts where PWA supports it.
- Minimal management/admin navigation.

Recommended quick actions:

- Log Session
- Assign Workout
- Add Assessment
- Add Measurement
- Upload Progress Photo
- Send Reminder
- Review Compliance
- Create Nutrition Plan

## 15. Acceptance Criteria

Trainer role is complete when:

- Trainer can access `/trainer`.
- Trainer cannot access `/admin`, `/organization`, or `/super-admin`.
- Trainer sees only assigned members.
- Trainer cannot view unassigned member profiles by URL.
- Trainer can manage only own sessions.
- Trainer can manage only assigned classes.
- Trainer cannot view payments or revenue reports.
- Trainer cannot manage memberships.
- Workout/nutrition assignment validates member assignment.
- Assessment and progress changes are audited.
- Communications are limited to assigned members.
- AI context cannot include unassigned members or financial data.
