import type { BlogPost, FaqItem, GalleryItem, MembershipPlan, NavItem, Program, Testimonial, Trainer } from "@/types/content";

export const siteConfig = {
  name: "Apex Performance Club",
  shortName: "Apex",
  tagline: "Train with intent. Move with power.",
  description:
    "A premium fitness club built for strength, conditioning, mobility, and consistent progress with expert coaches and a polished member experience.",
  phone: "+91 98765 43210",
  email: "hello@apexperformance.club",
  whatsapp: "919876543210",
  address: "Level 2, Meridian Fitness District, Baner, Pune, Maharashtra",
  hours: "Mon-Sat 5:30 AM-10:00 PM, Sun 7:00 AM-2:00 PM",
  socials: [
    { label: "Instagram", href: "https://instagram.com" },
    { label: "YouTube", href: "https://youtube.com" },
    { label: "LinkedIn", href: "https://linkedin.com" }
  ] satisfies NavItem[]
};

export const navItems: NavItem[] = [
  { label: "About", href: "/about" },
  { label: "Programs", href: "/programs" },
  { label: "Membership", href: "/membership-plans" },
  { label: "Trainers", href: "/trainers" },
  { label: "Gallery", href: "/gallery" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" }
];

const image = (id: string, params = "auto=format&fit=crop&w=1400&q=82") =>
  `https://images.unsplash.com/${id}?${params}`;

export const programs: Program[] = [
  {
    slug: "strength-training",
    title: "Strength Training",
    summary: "Progressive coaching for confident lifting, muscle, and control.",
    description:
      "Build strength with structured programming, precise form correction, and progressive overload across free weights, racks, machines, and functional accessories.",
    benefits: ["Stronger compound lifts", "Better movement technique", "Progressive weekly structure", "Confidence under the bar"],
    audience: "Beginners, returning lifters, and strength-focused members.",
    image: image("photo-1534438327276-14e5300c3a48"),
    cta: "View Strength"
  },
  {
    slug: "weight-loss",
    title: "Weight Loss",
    summary: "Sustainable training and habits without extreme routines.",
    description:
      "A practical program combining gym consistency, conditioning, strength, and nutrition direction to support measurable weight management.",
    benefits: ["Habit-led progress", "Conditioning blocks", "Nutrition basics", "Visible accountability"],
    audience: "Members seeking steady fat loss and healthier routines.",
    image: image("photo-1571019613454-1cb2f99b2d8b"),
    cta: "Start Your Plan"
  },
  {
    slug: "muscle-building",
    title: "Muscle Building",
    summary: "Hypertrophy-focused plans built around consistency and recovery.",
    description:
      "Train with volume, intensity, and recovery structure. Coaches help you progress without wasting sessions on guesswork.",
    benefits: ["Hypertrophy splits", "Technique refinement", "Recovery-aware planning", "Progress tracking"],
    audience: "Members who want size, shape, and long-term strength.",
    image: image("photo-1599058917212-d750089bc07e"),
    cta: "Build Muscle"
  },
  {
    slug: "functional-training",
    title: "Functional Training",
    summary: "Athletic movement for real-world strength and coordination.",
    description:
      "Improve balance, mobility, core strength, and athletic control through coached full-body movement patterns.",
    benefits: ["Better coordination", "Core strength", "Movement quality", "Athletic carryover"],
    audience: "Professionals, athletes, and members who want useful strength.",
    image: image("photo-1518611012118-696072aa579a"),
    cta: "Move Better"
  },
  {
    slug: "hiit",
    title: "HIIT",
    summary: "High-output sessions for stamina, energy, and conditioning.",
    description:
      "Coach-led intervals that balance effort with safety, helping you improve cardiovascular fitness and training intensity.",
    benefits: ["High-energy sessions", "Improved stamina", "Coached intensity", "Time-efficient workouts"],
    audience: "Members who like guided, fast-paced training.",
    image: image("photo-1518310383802-640c2de311b2"),
    cta: "Try HIIT"
  },
  {
    slug: "cross-training",
    title: "Cross Training",
    summary: "Strength, conditioning, and skill work in one focused format.",
    description:
      "A varied training path that blends lifting, conditioning, carries, mobility, and team-style intensity.",
    benefits: ["Varied sessions", "Strength endurance", "Team energy", "Functional capacity"],
    audience: "Members who want variety and performance.",
    image: image("photo-1540497077202-7c8a3999166f"),
    cta: "Train Across"
  },
  {
    slug: "yoga",
    title: "Yoga",
    summary: "Mobility, breath, balance, and recovery for stronger training.",
    description:
      "A calm but purposeful practice for flexibility, joint control, posture, and recovery from high-output training.",
    benefits: ["Improved mobility", "Breath control", "Recovery support", "Better posture"],
    audience: "Members who want balance, recovery, and movement range.",
    image: image("photo-1506126613408-eca07ce68773"),
    cta: "Reset Mobility"
  },
  {
    slug: "personal-training",
    title: "Personal Training",
    summary: "One-to-one coaching with structure, accountability, and review.",
    description:
      "Work directly with a coach who adapts training to your goals, schedule, ability, and progress data.",
    benefits: ["Custom plan", "Form correction", "Weekly accountability", "Goal-specific coaching"],
    audience: "Beginners, transformation members, and anyone wanting focused coaching.",
    image: image("photo-1574680096145-d05b474e2155"),
    cta: "Meet Coaches"
  }
];

export const membershipPlans: MembershipPlan[] = [
  {
    slug: "monthly",
    name: "Monthly",
    duration: "30 days",
    price: "₹3,499",
    bestFor: "Flexible starts",
    description: "A simple way to begin training with premium gym access and member portal support.",
    features: ["Gym floor access", "Member portal", "Payment receipts", "Renewal reminders", "Free onboarding walkthrough"]
  },
  {
    slug: "quarterly",
    name: "Quarterly",
    duration: "90 days",
    price: "₹8,999",
    bestFor: "Routine building",
    description: "A focused 90-day commitment for members ready to build momentum and consistency.",
    features: ["Everything in Monthly", "Priority class booking", "Quarterly progress review", "Trainer consultation", "Better value per month"],
    highlighted: true
  },
  {
    slug: "half-yearly",
    name: "Half-Yearly",
    duration: "180 days",
    price: "₹15,999",
    bestFor: "Visible progress",
    description: "Six months of structured access for members serious about measurable training progress.",
    features: ["Everything in Quarterly", "Two progress reviews", "Guest pass", "Freeze option", "Personal training discount"]
  },
  {
    slug: "annual",
    name: "Annual",
    duration: "365 days",
    price: "₹27,999",
    bestFor: "Long-term performance",
    description: "The best-value membership for members who want Apex as part of their lifestyle.",
    features: ["Everything in Half-Yearly", "Best annual value", "Four progress reviews", "Premium support", "Exclusive member events"]
  }
];

export const trainers: Trainer[] = [
  {
    slug: "rohan-mehta",
    name: "Rohan Mehta",
    role: "Strength and Hypertrophy Coach",
    experience: "9 years",
    certifications: ["ACE CPT", "Strength Programming Specialist"],
    specialization: "Strength Training",
    bio: "Rohan helps members build strength with clean technique, progressive programming, and calm, precise coaching.",
    image: image("photo-1594381898411-846e7d193883")
  },
  {
    slug: "anika-rao",
    name: "Anika Rao",
    role: "HIIT and Conditioning Coach",
    experience: "7 years",
    certifications: ["NASM CPT", "Group Fitness Specialist"],
    specialization: "HIIT",
    bio: "Anika leads high-energy conditioning sessions built around effort, safety, and sustainable intensity.",
    image: image("photo-1609899537878-88d5ba429bdb")
  },
  {
    slug: "kabir-sethi",
    name: "Kabir Sethi",
    role: "Mobility and Corrective Exercise Coach",
    experience: "8 years",
    certifications: ["FMS Level 2", "Corrective Exercise Specialist"],
    specialization: "Mobility",
    bio: "Kabir focuses on movement quality, recovery-aware training, and helping members move with more control.",
    image: image("photo-1582102050730-0f28f2b7ad0f")
  },
  {
    slug: "sara-khan",
    name: "Sara Khan",
    role: "Transformation and Lifestyle Coach",
    experience: "6 years",
    certifications: ["Precision Nutrition L1", "ACE CPT"],
    specialization: "Weight Loss",
    bio: "Sara supports members through training habits, nutrition basics, and weekly accountability.",
    image: image("photo-1621184455862-c163dfb30e0f")
  }
];

export const gallery: GalleryItem[] = [
  { id: "floor", title: "Strength Floor", category: "Gym Interior", image: image("photo-1534438327276-14e5300c3a48", "auto=format&fit=crop&w=1100&q=82"), alt: "Modern strength training floor with racks and benches" },
  { id: "equipment", title: "Premium Equipment", category: "Equipment", image: image("photo-1540497077202-7c8a3999166f", "auto=format&fit=crop&w=1100&q=82"), alt: "Premium gym equipment and dumbbell training area" },
  { id: "workout", title: "Coached Training", category: "Workouts", image: image("photo-1571019613454-1cb2f99b2d8b", "auto=format&fit=crop&w=1100&q=82"), alt: "Athlete training with battle ropes in a gym" },
  { id: "class", title: "Group Energy", category: "Group Classes", image: image("photo-1518310383802-640c2de311b2", "auto=format&fit=crop&w=1100&q=82"), alt: "Group fitness class training together" },
  { id: "event", title: "Member Events", category: "Events", image: image("photo-1518611012118-696072aa579a", "auto=format&fit=crop&w=1100&q=82"), alt: "Fitness event training session" },
  { id: "transformation", title: "Progress Culture", category: "Transformations", image: image("photo-1599058917212-d750089bc07e", "auto=format&fit=crop&w=1100&q=82"), alt: "Member lifting in a premium training environment" },
  { id: "mobility", title: "Mobility Studio", category: "Gym Interior", image: image("photo-1506126613408-eca07ce68773", "auto=format&fit=crop&w=1100&q=82"), alt: "Calm yoga and mobility training space" },
  { id: "coaching", title: "Personal Coaching", category: "Workouts", image: image("photo-1574680096145-d05b474e2155", "auto=format&fit=crop&w=1100&q=82"), alt: "Personal trainer coaching a member through a workout" }
];

export const testimonials: Testimonial[] = [
  {
    name: "Priya S.",
    role: "Annual Member",
    rating: 5,
    quote: "Apex helped me stop guessing. The trainers built a plan I could follow, and the portal made payments and renewals simple.",
    result: "Built a 4-day weekly routine in 12 weeks",
    videoLabel: "Video story available"
  },
  {
    name: "Arjun M.",
    role: "Strength Member",
    rating: 5,
    quote: "The gym feels premium without being intimidating. Clean equipment, focused sessions, and coaches who actually correct your form.",
    result: "Improved squat and deadlift technique"
  },
  {
    name: "Neha R.",
    role: "Group Class Member",
    rating: 5,
    quote: "I joined for a trial and stayed because the structure worked. Classes, attendance, and trainer updates keep me accountable.",
    result: "Moved from irregular workouts to 15 visits a month",
    videoLabel: "Class journey highlight"
  },
  {
    name: "Dev P.",
    role: "Performance Member",
    rating: 5,
    quote: "The quarterly plan gave me enough time to build a real routine. I know what I am training, when I am training, and what comes next.",
    result: "Completed a 90-day consistency block"
  },
  {
    name: "Meera J.",
    role: "Elite Member",
    rating: 5,
    quote: "The front desk experience is smooth, the payments are clear, and the gym floor is always organized. It feels like a proper club.",
    result: "Renewed into annual membership"
  },
  {
    name: "Karan V.",
    role: "Personal Training Member",
    rating: 5,
    quote: "Personal training at Apex changed how I lift. I feel stronger, safer, and more consistent than I did training on my own.",
    result: "Added personal coaching after trial"
  }
];

export const faqs: FaqItem[] = [
  { category: "Membership", question: "Can I try the gym before buying a membership?", answer: "Yes. Book a free trial to visit the club, explore the training floor, meet the team, and understand the right plan before joining." },
  { category: "Membership", question: "Which membership should I choose?", answer: "Choose Monthly for flexibility, Quarterly for routine-building, Half-Yearly for visible progress, and Annual for the best long-term value." },
  { category: "Payments", question: "Can I pay online?", answer: "Yes. Membership payments are designed for future Razorpay checkout, with receipts available through the member portal after integration." },
  { category: "Payments", question: "Do you support offline payments?", answer: "Yes. Staff can assist with approved offline methods at the front desk while the payment record remains visible for membership tracking." },
  { category: "Classes", question: "Are classes included in every plan?", answer: "Class access depends on your membership plan and class capacity. Plan details clearly show included benefits before you join." },
  { category: "Classes", question: "Can I cancel a class booking?", answer: "Yes, if cancellation is within the allowed window. The class detail flow will show whether cancellation is available." },
  { category: "Trainers", question: "Do I need a trainer to get started?", answer: "No. You can train independently, join group classes, or add personal coaching. Beginners can request guidance during onboarding." },
  { category: "Trainers", question: "Do trainers create workout and diet plans?", answer: "Trainer-created workout and diet plans are available with coaching packages or eligible memberships in future portal phases." },
  { category: "Facilities", question: "Is Apex beginner-friendly?", answer: "Yes. Apex is built for focused training at every level, with structured programs, clear coaching, and premium facilities." },
  { category: "Facilities", question: "What are the opening hours?", answer: "The club is open Monday to Saturday from 5:30 AM to 10:00 PM and Sunday from 7:00 AM to 2:00 PM." }
];

export const blogPosts: BlogPost[] = [
  {
    slug: "choose-right-gym-membership",
    title: "How to Choose the Right Gym Membership for Your Routine",
    excerpt: "A practical guide to matching membership duration, coaching support, and class access to the way you actually train.",
    category: "Lifestyle",
    tags: ["membership", "routine", "beginners"],
    image: image("photo-1549060279-7e168fcee0c2"),
    publishedAt: "2026-05-18",
    readTime: "6 min read",
    author: "Apex Coaching Team",
    content: [
      "A good membership should fit your schedule, training style, and commitment level. The best plan is not always the longest plan; it is the one you will use consistently.",
      "Start by deciding whether you need flexibility, structure, or long-term value. Monthly access is useful for new members, while a quarterly block gives you enough time to build a routine and measure progress.",
      "If you want coaching, check whether trainer support, class access, or progress reviews are included. Transparent benefits matter more than a long list of vague perks."
    ]
  },
  {
    slug: "strength-training-beginners",
    title: "Strength Training for Beginners: What to Know Before You Start",
    excerpt: "Learn how to approach lifting with confidence, better technique, and a realistic progression plan.",
    category: "Fitness",
    tags: ["strength", "beginners", "technique"],
    image: image("photo-1534438327276-14e5300c3a48"),
    publishedAt: "2026-05-10",
    readTime: "7 min read",
    author: "Rohan Mehta",
    content: [
      "Strength training works best when it starts with control. Before adding heavy weight, learn the movement pattern, understand your range, and build repeatable technique.",
      "Beginners should focus on a few core movements, enough recovery, and steady progress. A coach can help you avoid common form mistakes and make every session more productive.",
      "Progress does not need to be dramatic every week. Consistent reps, better control, and small load increases create durable results."
    ]
  },
  {
    slug: "hiit-vs-strength-training",
    title: "HIIT vs Strength Training: Which Is Better for Your Goal?",
    excerpt: "Both styles can be powerful. The right choice depends on whether your priority is stamina, muscle, fat loss, or consistency.",
    category: "Weight Loss",
    tags: ["hiit", "strength", "fat loss"],
    image: image("photo-1518310383802-640c2de311b2"),
    publishedAt: "2026-04-28",
    readTime: "5 min read",
    author: "Anika Rao",
    content: [
      "HIIT and strength training solve different problems. HIIT improves conditioning and energy output, while strength training builds muscle, technique, and long-term capacity.",
      "For weight management, the best approach often combines both. Strength helps preserve muscle and improve shape, while conditioning supports cardiovascular fitness and training variety.",
      "Choose the routine you can sustain. A balanced plan beats an extreme plan that lasts only two weeks."
    ]
  },
  {
    slug: "mobility-for-desk-workers",
    title: "Simple Mobility Work for Desk Workers Who Train",
    excerpt: "Use mobility work to reduce stiffness, improve posture, and make strength sessions feel smoother.",
    category: "Recovery",
    tags: ["mobility", "recovery", "desk workers"],
    image: image("photo-1506126613408-eca07ce68773"),
    publishedAt: "2026-04-12",
    readTime: "4 min read",
    author: "Kabir Sethi",
    content: [
      "Long hours at a desk can make training feel harder than it needs to. Tight hips, stiff shoulders, and limited thoracic movement often show up during squats, presses, and running.",
      "A short mobility routine before training can improve position and comfort. Focus on breathing, controlled range, and consistency rather than forcing extreme stretches.",
      "Mobility is not separate from performance. Better movement quality makes strength and conditioning work more efficient."
    ]
  },
  {
    slug: "build-90-day-fitness-routine",
    title: "How to Build a Sustainable 90-Day Fitness Routine",
    excerpt: "A 90-day training block gives you enough time to build habits, measure progress, and adjust with clarity.",
    category: "Muscle Gain",
    tags: ["90 day plan", "consistency", "progress"],
    image: image("photo-1599058917212-d750089bc07e"),
    publishedAt: "2026-03-30",
    readTime: "6 min read",
    author: "Sara Khan",
    content: [
      "Ninety days is long enough to move beyond motivation and build repeatable systems. It lets you see what your schedule can support and what training style you enjoy enough to repeat.",
      "Start with three to four sessions per week, a clear goal, and simple tracking. Attendance, strength numbers, energy, and recovery are all useful signals.",
      "The routine should adapt as you learn. The goal is not perfection; the goal is a structure you can return to every week."
    ]
  }
];

