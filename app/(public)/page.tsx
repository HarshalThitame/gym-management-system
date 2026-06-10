import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Clock, Dumbbell, ShieldCheck, Sparkles, Star, Users, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { SectionHeading } from "@/components/ui/section-heading";
import { faqs, gallery, membershipPlans, programs, siteConfig, testimonials, trainers } from "@/data/site";
import { createMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = createMetadata({
  title: "Premium Fitness Club in Pune",
  description: "Train with intent at Apex Performance Club. Premium facilities, expert trainers, flexible memberships, free trials, classes, and a polished member experience.",
  path: "/"
});

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ExerciseGym",
    name: siteConfig.name,
    description: siteConfig.description,
    telephone: siteConfig.phone,
    email: siteConfig.email,
    url: absoluteUrl("/"),
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address,
      addressLocality: "Pune",
      addressRegion: "Maharashtra",
      addressCountry: "IN"
    },
    openingHours: "Mo-Sa 05:30-22:00, Su 07:00-14:00",
    priceRange: "₹₹₹"
  };

  return (
    <>
      <JsonLd data={structuredData} />
      <Hero />
      <BrandIntro />
      <WhyChooseUs />
      <ProgramsPreview />
      <MembershipPreview />
      <TrainerShowcase />
      <TransformationStories />
      <TestimonialsPreview />
      <Facilities />
      <GalleryPreview />
      <FaqPreview />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate min-h-[calc(100svh-64px)] overflow-hidden bg-obsidian text-white">
      <Image
        alt="Premium gym strength floor with modern equipment"
        className="absolute inset-0 -z-20 size-full object-cover"
        fill
        priority
        sizes="100vw"
        src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=2200&q=82"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(7_8_9/0.92),rgb(7_8_9/0.62)_46%,rgb(7_8_9/0.18))]" />
      <div className="container-page flex min-h-[calc(100svh-64px)] items-center py-16">
        <div className="max-w-3xl">
          <Reveal>
            <Badge className="border-white/20 bg-white/10 text-white" variant="neutral">Premium fitness club</Badge>
            <h1 className="mt-6 text-balance text-5xl font-black leading-[1.02] md:text-7xl">
              Train with intent. Move with power.
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-white/76 md:text-xl">
              A premium fitness club built for strength, conditioning, mobility, and consistent progress, with expert coaches and a member experience that keeps every step clear.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/membership-plans" size="lg" variant="accent">
                Join Now <ArrowRight aria-hidden="true" size={18} />
              </ButtonLink>
              <ButtonLink href="/free-trial" size="lg" variant="outline">
                Book Free Trial
              </ButtonLink>
            </div>
          </Reveal>
          <Reveal className="mt-10 grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4" delay={0.1}>
            {[
              ["6", "training zones"],
              ["4", "membership paths"],
              ["12+", "weekly classes"],
              ["100%", "coached onboarding"]
            ].map(([value, label]) => (
              <div className="rounded-lg border border-white/12 bg-white/10 p-4 backdrop-blur" key={label}>
                <div className="text-2xl font-black text-accent">{value}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-white/58">{label}</div>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function BrandIntro() {
  return (
    <section className="bg-background py-20 md:py-28">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
        <Reveal>
          <SectionHeading
            eyebrow="Built for measurable training"
            title="A club experience designed around consistency, coaching, and clarity."
            body="Apex brings together modern equipment, structured programs, experienced trainers, and a digital member journey so every visit feels purposeful from check-in to renewal."
          />
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Coach-led plans", "Programs adapted to your goal and starting level."],
            ["Modern facility", "Strength, conditioning, mobility, and recovery zones."],
            ["Simple membership", "Transparent plans, online-ready payments, renewal reminders."]
          ].map(([title, body], index) => (
            <Reveal delay={index * 0.06} key={title}>
              <Card className="h-full p-5">
                <Sparkles className="mb-5 text-secondary" size={22} />
                <h3 className="text-lg font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyChooseUs() {
  return (
    <section className="bg-obsidian py-20 text-white md:py-28">
      <div className="container-page">
        <Reveal>
          <SectionHeading
            className="[&_h2]:text-white [&_p]:text-white/68"
            eyebrow="Why choose Apex"
            title="Premium service, serious equipment, and a training floor that respects your time."
            body="Every part of Apex is designed to reduce friction: clear memberships, clean spaces, trainer support, fast inquiries, and a member-first operating system behind the experience."
          />
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {([
            [ShieldCheck, "Clean, organized facility", "A polished environment that feels professional from front desk to free weights."],
            [Users, "Expert coaching culture", "Trainers correct form, guide progression, and help members train safely."],
            [CalendarDays, "Classes with structure", "Strength, HIIT, mobility, and performance sessions built around consistency."],
            [Clock, "Fast member experience", "Free trials, inquiries, memberships, and renewals are designed to be simple."]
          ] satisfies Array<[LucideIcon, string, string]>).map(([Icon, title, body], index) => (
            <Reveal delay={index * 0.05} key={String(title)}>
              <div className="h-full rounded-lg border border-white/10 bg-white/[0.06] p-5">
                <Icon aria-hidden="true" className="text-accent" size={24} />
                <h3 className="mt-5 text-lg font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/62">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProgramsPreview() {
  return (
    <section className="bg-background py-20 md:py-28">
      <div className="container-page">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <Reveal>
            <SectionHeading eyebrow="Programs" title="Training paths for strength, stamina, mobility, and real consistency." />
          </Reveal>
          <ButtonLink className="w-fit" href="/programs" variant="secondary">Explore Programs</ButtonLink>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {programs.slice(0, 6).map((program, index) => (
            <Reveal delay={index * 0.04} key={program.slug}>
              <Link className="group block overflow-hidden rounded-lg border border-border bg-surface" href="/programs">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image alt={`${program.title} program at Apex`} className="object-cover transition duration-300 group-hover:scale-[1.03]" fill sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" src={program.image} />
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-black">{program.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{program.summary}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold">
                    {program.cta} <ArrowRight aria-hidden="true" size={16} />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function MembershipPreview() {
  return (
    <section className="bg-surface-muted py-20 md:py-28">
      <div className="container-page">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Memberships"
            title="Memberships that match how you train."
            body="Choose flexible access, a focused 90-day block, six months of visible progress, or the best long-term annual value."
          />
        </Reveal>
        <div className="mt-10 grid gap-5 lg:grid-cols-4">
          {membershipPlans.map((plan, index) => (
            <Reveal delay={index * 0.05} key={plan.slug}>
              <Card className={plan.highlighted ? "relative h-full border-ink bg-ink p-5 text-white" : "h-full p-5"}>
                {plan.highlighted ? <Badge className="mb-4" variant="premium">Recommended</Badge> : null}
                <h3 className="text-2xl font-black">{plan.name}</h3>
                <p className={plan.highlighted ? "mt-2 text-sm text-white/62" : "mt-2 text-sm text-muted-foreground"}>{plan.bestFor}</p>
                <div className="mt-5 flex items-end gap-2">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className={plan.highlighted ? "pb-1 text-sm text-white/55" : "pb-1 text-sm text-muted-foreground"}>/ {plan.duration}</span>
                </div>
                <p className={plan.highlighted ? "mt-4 text-sm leading-6 text-white/68" : "mt-4 text-sm leading-6 text-muted-foreground"}>{plan.description}</p>
                <ul className="mt-5 grid gap-3">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li className="flex gap-2 text-sm" key={feature}>
                      <Check className={plan.highlighted ? "mt-0.5 shrink-0 text-accent" : "mt-0.5 shrink-0 text-secondary"} size={16} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <ButtonLink className="mt-6 w-full" href="/membership-plans" variant={plan.highlighted ? "accent" : "primary"}>
                  Choose {plan.name}
                </ButtonLink>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrainerShowcase() {
  return (
    <section className="bg-background py-20 md:py-28">
      <div className="container-page">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <Reveal>
            <SectionHeading eyebrow="Coaches" title="Coaches who know how to move you forward." />
          </Reveal>
          <ButtonLink className="w-fit" href="/trainers" variant="secondary">Meet the Coaches</ButtonLink>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {trainers.map((trainer, index) => (
            <Reveal delay={index * 0.05} key={trainer.slug}>
              <Card className="overflow-hidden">
                <div className="relative aspect-[3/4]">
                  <Image alt={`${trainer.name}, ${trainer.role}`} className="object-cover" fill sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw" src={trainer.image} />
                </div>
                <div className="p-5">
                  <Badge variant="info">{trainer.specialization}</Badge>
                  <h3 className="mt-4 text-xl font-black">{trainer.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">{trainer.role}</p>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function TransformationStories() {
  return (
    <section className="bg-obsidian py-20 text-white md:py-28">
      <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Reveal>
          <SectionHeading
            className="[&_h2]:text-white [&_p]:text-white/68"
            eyebrow="Transformation stories"
            title="Progress you can feel, track, and repeat."
            body="From first-week confidence to long-term strength, members build routines that fit real schedules. Trainers help set the plan, attendance keeps progress visible, and the portal keeps membership details simple."
          />
          <ButtonLink className="mt-7" href="/testimonials" variant="accent">Read Member Stories</ButtonLink>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["12-week", "consistency blocks"],
            ["15+", "monthly visits built by members"],
            ["4", "training paths for progress"]
          ].map(([value, label], index) => (
            <Reveal delay={index * 0.06} key={label}>
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-6">
                <div className="text-4xl font-black text-accent">{value}</div>
                <p className="mt-3 text-sm font-semibold text-white/66">{label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsPreview() {
  return (
    <section className="bg-background py-20 md:py-28">
      <div className="container-page">
        <Reveal>
          <SectionHeading align="center" eyebrow="Member proof" title="Trusted by members who train for real life." />
        </Reveal>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {testimonials.slice(0, 3).map((item, index) => (
            <Reveal delay={index * 0.06} key={item.name}>
              <Card className="h-full p-6">
                <span className="sr-only">{item.rating} star review</span>
                <div aria-hidden="true" className="flex gap-1 text-amber-500">
                  {Array.from({ length: item.rating }).map((_, starIndex) => (
                    <Star aria-hidden="true" fill="currentColor" key={starIndex} size={16} />
                  ))}
                </div>
                <blockquote className="mt-5 text-lg font-semibold leading-8">“{item.quote}”</blockquote>
                <div className="mt-6 border-t border-border pt-4">
                  <p className="font-black">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.role}</p>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Facilities() {
  return (
    <section className="bg-surface-muted py-20 md:py-28">
      <div className="container-page grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <Reveal>
          <SectionHeading
            eyebrow="Facilities"
            title="Premium facilities built for focused training."
            body="Strength floor, conditioning zone, mobility space, personal coaching areas, and clean member amenities in one polished environment."
          />
          <ul className="mt-7 grid gap-3">
            {["Modern racks, benches, cables, and free weights", "Conditioning zone for high-output sessions", "Mobility and recovery area for better movement", "Clean changing areas and member-friendly amenities"].map((item) => (
              <li className="flex gap-3 text-sm font-semibold text-foreground" key={item}>
                <Check className="mt-0.5 shrink-0 text-secondary" size={18} /> {item}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal>
          <div className="grid grid-cols-2 gap-4">
            {gallery.slice(0, 4).map((item, index) => (
              <div className={index === 0 ? "relative col-span-2 aspect-[16/9] overflow-hidden rounded-lg" : "relative aspect-square overflow-hidden rounded-lg"} key={item.id}>
                <Image alt={item.alt} className="object-cover" fill sizes="(min-width: 1024px) 45vw, 100vw" src={item.image} />
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function GalleryPreview() {
  return (
    <section className="bg-background py-20 md:py-28">
      <div className="container-page">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <Reveal>
            <SectionHeading eyebrow="Gallery" title="See the space before you step in." />
          </Reveal>
          <ButtonLink className="w-fit" href="/gallery" variant="secondary">Open Gallery</ButtonLink>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {gallery.slice(0, 8).map((item, index) => (
            <Reveal delay={index * 0.03} key={item.id}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-surface">
                <Image alt={item.alt} className="object-cover" fill loading="lazy" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" src={item.image} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 text-white">
                  <p className="text-sm font-black">{item.title}</p>
                  <p className="text-xs text-white/70">{item.category}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqPreview() {
  return (
    <section className="bg-surface-muted py-20 md:py-28">
      <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <SectionHeading eyebrow="FAQ" title="Everything you need to know before your first session." />
          <ButtonLink className="mt-7" href="/faq" variant="primary">View All FAQs</ButtonLink>
        </Reveal>
        <div className="grid gap-3">
          {faqs.slice(0, 6).map((faq) => (
            <Reveal key={faq.question}>
              <details className="group rounded-lg border border-border bg-surface p-5">
                <summary className="cursor-pointer list-none text-base font-black marker:hidden">{faq.question}</summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-obsidian py-20 text-white md:py-28">
      <div className="container-page text-center">
        <Reveal>
          <Dumbbell className="mx-auto text-accent" size={34} />
          <h2 className="mx-auto mt-5 max-w-3xl text-balance text-4xl font-black leading-tight md:text-6xl">
            Your strongest routine can start this week.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/68">
            Book a free trial, visit the club, or speak with our team about the right membership for your goals.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/free-trial" size="lg" variant="accent">Book Free Trial</ButtonLink>
            <ButtonLink href="/contact" size="lg" variant="outline">Talk to Staff</ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
