# 10 - SEO and Marketing Requirements

## 1. SEO Goals

- Rank for local gym and fitness queries in the gym's city/area.
- Convert organic visitors into inquiries, free trials, WhatsApp conversations, and memberships.
- Build topical authority through fitness, nutrition, workout, and local wellness blog content.
- Make public pages shareable with complete metadata and Open Graph assets.
- Support Google Business Profile visibility through consistent NAP data.

NAP means name, address, and phone.

## 2. SEO Page Structure

| Page | SEO Purpose | Primary Keyword Examples |
| --- | --- | --- |
| Home | Brand and local gym landing page. | gym in {city}, fitness center in {area}, best gym near me |
| About | Trust and facility credibility. | gym facilities in {city}, fitness club {brand} |
| Membership Plans | Commercial intent. | gym membership plans {city}, gym fees {area} |
| Trainers | Trainer credibility and specialties. | personal trainer {city}, fitness trainer {area} |
| Gallery | Facility proof and image search. | gym photos {city}, gym equipment {area} |
| Testimonials | Social proof. | gym reviews {city}, fitness transformation {area} |
| Blog | Informational traffic. | workout tips, diet tips, strength training, weight loss |
| Contact | Local conversion. | gym contact {area}, gym location {city} |
| Free Trial | Lead conversion. | free gym trial {city}, gym trial near me |

## 3. Metadata Requirements

Each public page must define:

- SEO title.
- Meta description.
- Canonical URL.
- Open Graph title.
- Open Graph description.
- Open Graph image.
- Twitter/X card metadata.
- Robots settings where appropriate.
- Structured schema where relevant.

### 3.1 Metadata Guidelines

| Field | Requirement |
| --- | --- |
| Title | 50 to 60 characters where practical; include brand and city for key local pages. |
| Description | 140 to 160 characters where practical; include value proposition and CTA. |
| Canonical | Always use the production URL for canonical pages. |
| OG Image | Use real gym, trainer, or facility image; avoid generic abstract assets. |
| Slugs | Lowercase, hyphenated, readable, unique. |
| H1 | One primary H1 per page. |
| Headings | Use logical hierarchy and include locality where natural. |

## 4. Schema Markup

Recommended schema:

| Page | Schema Type | Required Properties |
| --- | --- | --- |
| Home | `LocalBusiness`, `HealthClub` or `ExerciseGym` where supported | Name, address, phone, opening hours, geo, URL, logo, images, price range |
| Membership Plans | `Product` or `OfferCatalog` | Plan names, prices, currency, availability |
| Trainers | `Person` | Name, job title, image, description, worksFor |
| Blog Detail | `BlogPosting` | Headline, author, date published, date modified, image |
| Testimonials | `Review` aggregate where compliant | Rating, author, review body, item reviewed |
| Contact | `LocalBusiness` | Address, phone, email, map, opening hours |
| FAQ sections | `FAQPage` | Question and answer pairs |
| Breadcrumbs | `BreadcrumbList` | Position, name, item URL |

Important:

- Do not add fake ratings or unverified reviews.
- Test structured data before launch.
- Keep schema data consistent with visible page content.

## 5. Local SEO Requirements

| Area | Requirement |
| --- | --- |
| NAP consistency | Gym name, address, and phone must match Google Business Profile and directory listings. |
| Location keywords | Include city/area naturally in home, contact, plans, and headings. |
| Map integration | Contact page should include Google Maps link or embed. |
| Opening hours | Display business hours and include schema opening hours. |
| Location landing | If multiple branches are added, each branch gets a dedicated location page. |
| Reviews | Encourage real member reviews through post-trial and post-renewal communication. |
| Images | Use facility and trainer photos with descriptive alt text. |

## 6. Google Business Integration

MVP requirements:

- Display Google Business Profile link on contact page.
- Use same NAP details as Google Business Profile.
- Add "Get directions" link to Google Maps.
- Track clicks to Google Maps and WhatsApp where analytics is configured.

Phase 2 or later:

- Add admin settings for Google Business Profile URL.
- Add review request email after trial completion or membership activation.
- Add UTM tracking for Google Business website links.
- Consider Google Business Profile API only if there is a clear management need.

## 7. Lead Generation Strategy

### 7.1 Contact Forms

| Requirement | Detail |
| --- | --- |
| Fields | Name, phone, email optional, subject, message, consent. |
| Conversion | Create lead with source `contact`. |
| Follow-up | Notify staff and show confirmation. |
| Validation | Phone required, email valid if present, message length limited. |
| Anti-abuse | Rate limit, honeypot or bot protection if needed. |

### 7.2 Free Trial Forms

| Requirement | Detail |
| --- | --- |
| Fields | Name, phone, email optional, preferred date/time, fitness goal, consent. |
| Conversion | Create lead with source `free_trial`. |
| Follow-up | Send confirmation and show staff task in leads. |
| Validation | Preferred date/time not in the past and within operating hours where possible. |
| Duplicate handling | Warn or prevent repeated active trials by same phone/email. |

### 7.3 WhatsApp Integration

| Requirement | Detail |
| --- | --- |
| Public CTA | Visible on home, plans, contact, free trial, and mobile nav. |
| Prefilled text | Include source page context, for example "I want to know about membership plans." |
| Tracking | Capture click event through analytics where configured. |
| Lead creation | MVP can track click only; Phase 2 can create lead before redirect if consent and UX allow. |
| Admin setting | Store WhatsApp number in gym settings. |

### 7.4 Newsletter

| Requirement | Detail |
| --- | --- |
| Purpose | Capture low-intent visitors for future offers and fitness content. |
| Fields | Email, optional name, marketing consent. |
| Storage | `leads` with source `newsletter` or separate subscriber table in future. |
| Email | Use Resend for transactional confirmation; marketing campaigns need unsubscribe support. |
| Compliance | Consent required before marketing emails. |

## 8. Conversion Requirements

| Page | Primary CTA | Secondary CTA |
| --- | --- | --- |
| Home | Book Free Trial | View Plans, WhatsApp |
| Membership Plans | Buy/Renew Plan | Book Free Trial, WhatsApp |
| Trainer Detail | Book Free Trial | Contact |
| Gallery | Book Free Trial | View Plans |
| Testimonials | Book Free Trial | View Plans |
| Blog Detail | Book Free Trial | Related posts, newsletter |
| Contact | Submit Inquiry | WhatsApp, directions |
| Free Trial | Submit Trial Request | View Plans |

CTA rules:

- CTAs should be visible without overwhelming the page.
- Mobile pages should keep primary conversion actions easy to reach.
- Form completion should have a clear success state and next step.

## 9. Content Strategy

### 9.1 Blog Categories

| Category | Example Topics |
| --- | --- |
| Weight Loss | Beginner weight loss workouts, calorie basics, consistency tips. |
| Strength Training | Progressive overload, compound lifts, gym routines. |
| Nutrition | Protein intake, diet mistakes, pre-workout meals. |
| Classes | Benefits of HIIT, yoga, Zumba, group fitness. |
| Gym Guides | First day at gym, how to choose a membership, gym etiquette. |
| Local Fitness | Fitness events, city-specific wellness content. |

### 9.2 Content Requirements

- Each blog post must have title, slug, excerpt, content, author, category, status, published date, SEO title, SEO description, and featured image.
- Blog images must have alt text.
- Related posts should be based on category or tags.
- Articles should link to membership plans, free trial, and relevant trainer pages where natural.

## 10. Analytics Requirements

Track:

- Page views.
- Free trial submissions.
- Contact submissions.
- WhatsApp clicks.
- Plan CTA clicks.
- Membership checkout starts.
- Payment successes/failures.
- Blog views.
- Google Maps direction clicks.
- Newsletter submissions.

Recommended event properties:

- `source_page`
- `plan_id`
- `lead_source`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `user_role` where authenticated and privacy-safe

## 11. SEO Technical Requirements

| Requirement | Detail |
| --- | --- |
| Sitemap XML | Include public pages, published blog posts, trainers, and plan detail pages. |
| Robots.txt | Allow public pages; disallow admin/member/trainer routes. |
| Canonicals | Add canonical URLs to all public pages. |
| Redirects | Redirect old slugs if content slug changes. |
| 404 | Provide custom not-found page with navigation to plans/trial/contact. |
| Image alt text | Required for gallery, trainers, blog featured images, testimonials. |
| Internal links | Link related public pages to improve crawlability. |
| Pagination | Blog pagination must use crawlable links. |
| Structured data | Add schema to relevant pages and validate. |

## 12. Marketing Automation Requirements

| Trigger | Message | Channel | Phase |
| --- | --- | --- | --- |
| Contact form submitted | Confirmation and expected follow-up. | Email optional, in-app/admin notification | MVP |
| Free trial requested | Trial request confirmation. | Email | MVP |
| Trial scheduled | Trial appointment confirmation. | Email | MVP |
| Trial completed | Membership offer/follow-up. | Email or manual staff task | Phase 2 |
| Membership activated | Welcome and receipt. | Email | MVP |
| Membership expiring soon | Renewal reminder. | Email/in-app | MVP/Phase 2 |
| Class booked | Booking confirmation. | Email/in-app | Phase 2 |
| Plan updated | Workout/diet update notification. | In-app/email optional | Phase 3 |

## 13. Launch SEO Checklist

| Item | Required |
| --- | --- |
| Production domain connected. | Yes |
| Google Search Console configured. | Yes |
| Sitemap submitted. | Yes |
| Google Business Profile URL linked. | Yes |
| Public page metadata reviewed. | Yes |
| Structured data validated. | Yes |
| Public images optimized and alt text added. | Yes |
| Privacy, terms, and refund policy published. | Yes |
| Lead form tracking tested. | Yes |
| Payment conversion tracking tested if analytics is enabled. | Yes |

