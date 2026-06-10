export type NavItem = {
  label: string;
  href: string;
};

export type Program = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  benefits: string[];
  audience: string;
  image: string;
  cta: string;
};

export type MembershipPlan = {
  slug: string;
  name: string;
  duration: string;
  price: string;
  bestFor: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

export type Trainer = {
  slug: string;
  name: string;
  role: string;
  experience: string;
  certifications: string[];
  specialization: string;
  bio: string;
  image: string;
};

export type GalleryItem = {
  id: string;
  title: string;
  category: "Gym Interior" | "Equipment" | "Workouts" | "Group Classes" | "Events" | "Transformations";
  image: string;
  alt: string;
};

export type Testimonial = {
  name: string;
  role: string;
  rating: number;
  quote: string;
  result: string;
  videoLabel?: string;
};

export type FaqItem = {
  category: "Membership" | "Payments" | "Classes" | "Trainers" | "Facilities";
  question: string;
  answer: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: "Fitness" | "Nutrition" | "Weight Loss" | "Muscle Gain" | "Recovery" | "Lifestyle";
  tags: string[];
  image: string;
  publishedAt: string;
  readTime: string;
  author: string;
  content: string[];
};

