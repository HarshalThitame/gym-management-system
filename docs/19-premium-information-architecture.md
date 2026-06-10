# 19 - Premium Website Information Architecture

## 1. Architecture Principles

The page hierarchy should feel like a premium fitness club website connected to a polished SaaS portal. Public pages should sell trust and aspiration. Portal pages should solve tasks quickly.

Navigation must be:

- Mobile-first.
- Conversion-led.
- Role-aware after login.
- Crawlable for public SEO pages.
- Compact and action-oriented in dashboards.

## 2. Public Website Hierarchy

| Page | Path | Primary Goal | Primary CTA |
| --- | --- | --- | --- |
| Home | `/` | Establish premium brand and convert visitors. | Book Free Trial |
| About | `/about` | Build trust through story, standards, facilities. | Visit the Club |
| Programs | `/programs` | Explain training categories and outcomes. | Find Your Program |
| Program Detail | `/programs/{slug}` | Convert visitors interested in a specific program. | Start This Program |
| Membership Plans | `/membership-plans` | Compare plans and start purchase. | Join Now |
| Plan Detail | `/membership-plans/{slug}` | Explain plan value and terms. | Choose Plan |
| Trainers | `/trainers` | Establish coaching credibility. | Meet the Coaches |
| Trainer Detail | `/trainers/{slug}` | Show expertise and personality. | Book a Trial |
| Gallery | `/gallery` | Prove facility quality visually. | See Memberships |
| Testimonials | `/testimonials` | Build social proof. | Start Your Trial |
| Blog | `/blog` | Capture SEO traffic. | Book Free Trial |
| Blog Detail | `/blog/{slug}` | Educate and convert. | Train With Us |
| FAQ | `/faq` | Remove objections. | Talk to Staff |
| Contact | `/contact` | Convert inquiries and visits. | Send Inquiry |
| Free Trial | `/free-trial` | High-intent lead capture. | Reserve Trial |

## 3. Public Navigation

Desktop:

- Apex
- Programs
- Membership
- Trainers
- Gallery
- Blog
- Contact
- Login
- Book Free Trial

Mobile:

- Header with logo, Book Trial icon/text button, menu button.
- Drawer links grouped as Explore, Join, Support.
- Drawer footer with phone, WhatsApp, hours, location.

Rules:

- "Book Free Trial" must remain the highest-emphasis public CTA.
- "Membership" should be the second-highest conversion route.
- Do not overload public nav with admin/member routes.

## 4. Member Area Hierarchy

| Page | Path | Primary Goal |
| --- | --- | --- |
| Dashboard | `/member` | Show membership status and next action. |
| Membership | `/member/membership` | View plan, dates, renewal, benefits. |
| Attendance | `/member/attendance` | View visits and class attendance. |
| Payments | `/member/payments` | View payments and receipts. |
| Classes | `/member/classes` | Browse and book classes. |
| Workout Plans | `/member/workout-plans` | View assigned workouts. |
| Profile | `/member/profile` | Manage profile and preferences. |

Member navigation priority:

1. Dashboard
2. Membership
3. Classes
4. Attendance
5. Payments
6. Workout Plans
7. Profile

## 5. Admin Area Hierarchy

| Page | Path | Primary Goal |
| --- | --- | --- |
| Dashboard | `/admin` | View operational and business overview. |
| Members | `/admin/members` | Manage member lifecycle. |
| Memberships | `/admin/memberships` | Manage membership records and plans. |
| Payments | `/admin/payments` | Reconcile and record payments. |
| Attendance | `/admin/attendance` | Check in members and review activity. |
| Trainers | `/admin/trainers` | Manage trainer profiles and assignments. |
| Classes | `/admin/classes` | Manage class schedule and bookings. |
| Leads | `/admin/leads` | Convert inquiries and trials. |
| Reports | `/admin/reports` | Analyze revenue, members, attendance, leads. |
| Settings | `/admin/settings` | Configure gym and integrations. |

Admin navigation priority:

1. Dashboard
2. Members
3. Payments
4. Leads
5. Attendance
6. Classes
7. Memberships
8. Trainers
9. Reports
10. Settings

## 6. Trainer Area Hierarchy

| Page | Path | Primary Goal |
| --- | --- | --- |
| Dashboard | `/trainer` | Show assigned members and upcoming sessions. |
| Members | `/trainer/members` | Access assigned member details. |
| Classes | `/trainer/classes` | View assigned classes and attendance. |
| Workout Plans | `/trainer/workout-plans` | Manage plans for assigned members. |
| Profile | `/trainer/profile` | Maintain trainer profile. |

## 7. Page Experience Model

| Page Type | Layout Pattern |
| --- | --- |
| Public landing pages | Strong first viewport, editorial sections, conversion bands, image-led proof. |
| Public listing pages | Filterable cards with SEO copy and conversion CTA. |
| Public detail pages | Hero, value proof, details, related content, conversion CTA. |
| Member portal pages | Summary first, clear status, fast next action, history below. |
| Admin list pages | Header action, search/filter row, dense table, saved views future. |
| Admin detail pages | Entity summary, tabs, audit-aware actions, right-side context on desktop. |
| Reports | Date range first, KPI summary, charts, detail table, export. |

## 8. Cross-Linking Strategy

| Source | Link To | Purpose |
| --- | --- | --- |
| Home hero | Free Trial, Membership Plans | Convert high-intent visitors. |
| Program cards | Program detail, Free Trial | Match visitor goals. |
| Trainer cards | Trainer detail, Free Trial | Build trust and convert. |
| Blog detail | Related programs, Free Trial | Convert SEO readers. |
| FAQ | Membership, Contact, Free Trial | Resolve objections. |
| Member dashboard | Renew, Classes, Payments | Drive self-service. |
| Admin dashboard | Members, Payments, Leads, Reports | Move quickly from metric to action. |

## 9. SEO and Content Architecture

Public pages should have:

- One clear H1.
- Metadata and canonical URL.
- Schema where relevant.
- Internal links to conversion pages.
- Real images with alt text.
- Short FAQ blocks where useful.

Program pages should target high-intent queries:

- Strength Training in {city}
- Personal Training in {city}
- HIIT Classes in {city}
- Weight Loss Program in {city}
- Mobility and Recovery Training in {city}

## 10. Premium UX Differentiators

- Show real class schedule preview on the homepage rather than generic claims.
- Show plan clarity with "best for" language instead of only pricing.
- Show trainer specialties with credible coaching context.
- Show member portal screenshots or product-like previews later in the public site to signal operational polish.
- Use facility photography with descriptive proof: equipment, training zones, recovery area, lockers, cleanliness.

