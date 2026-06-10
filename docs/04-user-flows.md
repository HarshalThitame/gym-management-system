# 04 - User Flows

## 1. Flow Notation

- Screen: A page, modal, drawer, or major view.
- Action: User-triggered event.
- System: Validation, data write, notification, redirect, or background process.
- Decision: Branching condition.

## 2. Guest Visitor Flows

### 2.1 Landing Page Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Home | Visitor opens site root. | Load published home content, plan teasers, testimonials, gallery preview, SEO metadata. | Home |
| 2 | Home | Visitor scrolls through sections. | Lazy-load below-fold images and content. | Same screen |
| 3 | Home | Visitor clicks "View Plans". | Navigate to membership plans. | Membership Plans |
| 4 | Home | Visitor clicks "Free Trial". | Navigate to trial page or open trial form section. | Free Trial |
| 5 | Home | Visitor clicks trainer card. | Navigate to trainer detail or trainers page. | Trainer Detail |
| 6 | Home | Visitor clicks WhatsApp CTA. | Open WhatsApp deep link with prefilled inquiry text. Track source if analytics configured. | External WhatsApp |

### 2.2 Inquiry Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Contact | Visitor opens contact page. | Load gym contact details, map embed/link, form, business hours. | Contact |
| 2 | Contact | Visitor enters name, phone, email, subject, message, consent. | Client validation checks required fields and formats. | Contact |
| 3 | Contact | Visitor submits form. | Server validates payload, rate limit, stores lead with source `contact`, sends optional confirmation email. | Contact Success |
| 4 | Contact Success | Visitor sees confirmation. | Show expected follow-up message and CTA to view plans or WhatsApp. | Home, Plans, or WhatsApp |
| 5 | Admin Leads | Staff receives lead. | Lead appears with status `new`. Optional email/internal notification sent. | Lead Detail |

Error transitions:

| Error | Behavior |
| --- | --- |
| Invalid phone/email | Keep visitor on form and show field-level error. |
| Rate limit exceeded | Show generic retry message; do not reveal anti-abuse rules. |
| Email delivery failed | Lead still saves; admin can follow up manually. |

### 2.3 Free Trial Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Free Trial | Visitor opens trial page. | Load form, benefits, policies, business hours. | Free Trial |
| 2 | Free Trial | Visitor enters name, phone, email, preferred date/time, goal, consent. | Client validates date, required fields, and phone. | Free Trial |
| 3 | Free Trial | Visitor submits request. | Server validates, checks duplicate active trial by phone/email, creates lead with type `free_trial`. | Trial Success |
| 4 | Trial Success | Visitor sees confirmation. | Show selected date/time and next steps. Send email if email available. | Trial Success |
| 5 | Admin Leads | Staff reviews trial request. | Staff can confirm, reschedule, mark contacted, or convert. | Lead Detail |
| 6 | Lead Detail | Staff confirms trial. | Status changes to `trial_scheduled`; notification sent. | Lead Detail |

Decision transitions:

| Condition | Next Behavior |
| --- | --- |
| Duplicate active trial exists | Show message asking visitor to contact gym; create optional duplicate lead note only if policy allows. |
| Requested time unavailable | Show validation message and alternate CTA to contact staff. |
| Visitor wants to purchase instead | CTA moves to Membership Plans. |

### 2.4 Membership Purchase Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Membership Plans | Visitor chooses a plan. | Store selected plan in server-side checkout context or URL-safe plan ID. | Plan Detail or Checkout Start |
| 2 | Checkout Start | Visitor clicks purchase. | If not authenticated, redirect to register/login with return path. | Register/Login |
| 3 | Register/Login | Visitor creates account or logs in. | Supabase Auth creates/validates session; profile completion checked. | Checkout Details |
| 4 | Checkout Details | User confirms profile and selected plan. | Server recalculates amount from plan record. | Payment |
| 5 | Payment | User pays through Razorpay. | Server creates Razorpay order. Client opens Razorpay checkout. | Payment Processing |
| 6 | Payment Processing | Razorpay returns result. | Server verifies payment callback where applicable; final status reconciled by webhook. | Payment Success or Pending |
| 7 | Payment Success | User sees receipt and membership details. | Membership activated once payment is captured. Receipt email sent. | Member Dashboard |

Error transitions:

| Error | Behavior |
| --- | --- |
| Payment failed | Show failure state with retry and contact support options. |
| Webhook delayed | Show pending state; member dashboard displays pending activation until payment captured. |
| Plan changed during checkout | Server rejects stale amount and asks user to restart checkout. |

## 3. Member Flows

### 3.1 Registration Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Register | User enters name, email, phone, password. | Validate required fields, password strength, phone format. | Register |
| 2 | Register | User submits. | Supabase creates auth account; application creates user/member profile. | Email Verification or Profile Setup |
| 3 | Email Verification | User opens verification email. | Supabase verifies email. | Login or Member Dashboard |
| 4 | Profile Setup | User completes required member fields. | Save member record with status based on membership/payment. | Member Dashboard |

Decision transitions:

| Condition | Next Behavior |
| --- | --- |
| User registered during checkout | Return to checkout details after auth. |
| Email already exists | Prompt login or password reset. |
| Staff-created member receives invite | User follows invite link to set password and verify profile. |

### 3.2 Login Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Login | User enters email and password. | Validate required fields. | Login |
| 2 | Login | User submits. | Supabase validates credentials and creates session. | Role Redirect |
| 3 | Role Redirect | System checks role and profile state. | Route user to correct dashboard. | Member Dashboard, Trainer Dashboard, or Admin Dashboard |
| 4 | Forgot Password | User requests reset. | Supabase sends password reset email. | Reset Confirmation |

Error transitions:

| Error | Behavior |
| --- | --- |
| Invalid credentials | Show generic invalid login message. |
| Email unverified | Show verification prompt and resend option. |
| Suspended account | Show contact support message. |

### 3.3 Member Dashboard Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Member Dashboard | Member opens portal. | Load membership status, attendance summary, upcoming classes, notifications. | Member Dashboard |
| 2 | Member Dashboard | Member clicks membership card. | Load detailed membership record. | Membership Details |
| 3 | Member Dashboard | Member clicks attendance card. | Load attendance list with filters. | Attendance |
| 4 | Member Dashboard | Member clicks class CTA. | Load class schedule. | Book Classes |
| 5 | Member Dashboard | Member clicks workout plan. | Load active workout plan. | Workout Plans |
| 6 | Member Dashboard | Member clicks notification. | Mark notification read and navigate to related entity if configured. | Notification Target |

### 3.4 Booking Classes Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Book Classes | Member views class calendar/list. | Load eligible upcoming classes and booking states. | Book Classes |
| 2 | Book Classes | Member selects class. | Load class detail, trainer, capacity, cancellation policy. | Class Detail |
| 3 | Class Detail | Member clicks book. | Server checks active membership, capacity, duplicate booking, cutoff rules. | Booking Confirmation |
| 4 | Booking Confirmation | System confirms booking. | Create booking, decrement available capacity, notify member. | Upcoming Classes |
| 5 | Upcoming Classes | Member cancels booking. | Server checks cancellation cutoff and updates booking status. | Booking Cancelled |

Decision transitions:

| Condition | Next Behavior |
| --- | --- |
| Membership inactive | Redirect to Membership Details with renewal CTA. |
| Class full | Show waitlist option if enabled; otherwise disable booking. |
| Duplicate booking | Show existing booking state. |
| Cancellation window passed | Show message and contact staff option. |

### 3.5 Renew Membership Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Member Dashboard | Member sees expiring/expired membership alert. | Show renewal CTA based on status. | Member Dashboard |
| 2 | Membership Details | Member clicks renew. | Load available renewal plans, preselect current plan if active. | Renewal Plan Selection |
| 3 | Renewal Plan Selection | Member selects plan. | Server calculates amount and renewal start date. | Payment |
| 4 | Payment | Member pays with Razorpay. | Create order, capture payment, process webhook. | Renewal Success |
| 5 | Renewal Success | Member sees updated membership. | New membership period active or scheduled depending on current end date. | Member Dashboard |

Renewal date rule:

| Current State | Renewal Start |
| --- | --- |
| Active membership | Day after current membership end date, unless admin config allows immediate replacement. |
| Expired membership | Payment capture date or configured activation date. |
| Pending payment | No activation until payment captured or admin records offline payment. |

## 4. Trainer Flows

### 4.1 Trainer Login Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Login | Trainer enters credentials. | Supabase validates session. | Role Redirect |
| 2 | Role Redirect | System detects trainer role. | Load trainer workspace. | Trainer Dashboard |
| 3 | Trainer Dashboard | Trainer reviews assigned members and classes. | Load assigned data only. | Trainer Dashboard |

### 4.2 View Assigned Members Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Trainer Dashboard | Trainer opens assigned members widget. | Query members assigned to trainer. | Assigned Members |
| 2 | Assigned Members | Trainer filters/searches members. | Return paginated assigned results. | Assigned Members |
| 3 | Assigned Members | Trainer opens member detail. | Verify assignment, load fitness profile, attendance, active plans. | Assigned Member Detail |
| 4 | Assigned Member Detail | Trainer selects workout or diet tab. | Load plan history and active plan. | Workout/Diet Plan Detail |

### 4.3 Update Workout Plans Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Assigned Member Detail | Trainer clicks create/update workout plan. | Verify assignment and trainer status. | Workout Plan Editor |
| 2 | Workout Plan Editor | Trainer enters plan name, goal, schedule, exercises, sets, reps, notes. | Validate structure and required fields. | Workout Plan Editor |
| 3 | Workout Plan Editor | Trainer saves draft. | Save plan with `draft` status. | Workout Plan Detail |
| 4 | Workout Plan Detail | Trainer publishes. | Mark active/published, retire previous active plan if required, notify member. | Workout Plan Detail |

Validation transitions:

| Error | Behavior |
| --- | --- |
| Trainer not assigned | Deny access and log authorization failure. |
| Empty exercise list | Show field error. |
| Invalid dates | Show date error. |

## 5. Admin Flows

### 5.1 Add Member Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Admin Members | Admin clicks add member. | Open create member form. | Add Member |
| 2 | Add Member | Admin enters profile and contact details. | Validate required fields, duplicate phone/email warning. | Add Member |
| 3 | Add Member | Admin selects membership plan optional. | Load plan details and price. | Add Member |
| 4 | Add Member | Admin submits. | Create user profile/member record. If membership selected, create pending membership/payment as configured. | Member Detail |
| 5 | Member Detail | Admin sends invite optional. | Send account setup email through Resend/Supabase invite flow. | Member Detail |

Decision transitions:

| Condition | Next Behavior |
| --- | --- |
| Duplicate email exists | Ask admin to link existing user or cancel. |
| Offline payment collected | Record payment and activate membership. |
| No payment yet | Membership remains pending or inactive. |

### 5.2 Create Membership Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Admin Membership Plans | Admin clicks create plan. | Open plan form. | Plan Form |
| 2 | Plan Form | Admin enters name, duration, price, benefits, status. | Validate price, duration, display order, duplicate name warning. | Plan Form |
| 3 | Plan Form | Admin saves draft. | Store plan as draft/unpublished. | Plan Detail |
| 4 | Plan Detail | Admin publishes. | Plan becomes visible for staff and public if marked public. | Membership Plans |
| 5 | Admin Member Detail | Admin creates membership for member. | Select member and plan, calculate dates, create membership record. | Member Membership Detail |

### 5.3 Manage Attendance Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Admin Attendance | Staff opens attendance module. | Load today's attendance and search. | Attendance |
| 2 | Attendance | Staff searches member. | Query active/recent members. | Attendance Search Results |
| 3 | Attendance Search Results | Staff selects member and clicks check in. | Verify member status and duplicate check-in window. | Check-In Confirmation |
| 4 | Check-In Confirmation | Staff confirms. | Create attendance record with source `manual` and recorded-by user. | Attendance |
| 5 | Attendance | Staff edits incorrect record. | Require reason, update record, audit before/after. | Attendance Detail |

Decision transitions:

| Condition | Next Behavior |
| --- | --- |
| Membership expired | Show warning; allow override only for authorized roles. |
| Duplicate check-in | Show existing record and prevent duplicate unless override permission. |
| Class attendance | Select class booking and mark attended/no-show. |

### 5.4 Generate Reports Flow

| Step | Screen | Action | System Behavior | Next Screen |
| --- | --- | --- | --- | --- |
| 1 | Admin Reports | Admin opens reports module. | Show report categories and default current month. | Reports |
| 2 | Reports | Admin selects report type and date range. | Validate range and permissions. | Report Detail |
| 3 | Report Detail | System loads data. | Query indexed tables or reporting views. | Report Detail |
| 4 | Report Detail | Admin changes filters. | Refresh data and charts. | Report Detail |
| 5 | Report Detail | Admin exports. | Generate CSV/PDF in Phase 2 or later; audit export. | Export Download or Export Pending |

Report transitions:

| Report Type | Detail Screen |
| --- | --- |
| Revenue | Revenue by day/month, method, plan, failed payments, refunds |
| Members | Active, new, expired, churned, renewals |
| Attendance | Daily check-ins, member frequency, peak times |
| Leads | Lead source, status funnel, conversion rate |
| Classes | Occupancy, cancellations, trainer utilization |

## 6. Cross-Role Navigation Rules

| Situation | Navigation Rule |
| --- | --- |
| User is authenticated and opens `/login` | Redirect to role dashboard. |
| User lacks permission for admin page | Show forbidden page or redirect to dashboard with error state. |
| Session expires | Redirect to login with return URL. |
| Member opens admin URL | Return forbidden, do not reveal admin data. |
| Guest opens member portal URL | Redirect to login with return URL. |
| Payment success opens without verified state | Show pending verification and poll/refresh status safely. |

