import type { Metadata } from "next";
import { CalendarCheck, CheckCircle2, Dumbbell, MessageCircle, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LazyLeadForm } from "@/features/public/components/lazy-lead-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { programs, siteConfig } from "@/data/site";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Book a Free Gym Trial",
  description: "Book a free trial at Apex Performance Club. Visit the gym, meet the team, explore programs, and choose the right membership.",
  path: "/free-trial"
});

export default function FreeTrialPage() {
  const whatsappHref = `https://wa.me/${siteConfig.whatsapp}?text=${encodeURIComponent("Hi Apex, I want to reserve a free trial session.")}`;

  return (
    <>
      <section className="bg-obsidian py-20 text-white md:py-28">
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">Free Trial</p>
            <h1 className="mt-4 text-balance text-5xl font-black leading-tight md:text-7xl">Book a free trial and experience Apex before you join.</h1>
            <p className="mt-6 text-lg leading-8 text-white/70">Visit the club, explore the training floor, meet the team, and understand the best membership path for your goals.</p>
            <div className="mt-8 grid gap-3 text-sm font-semibold text-white/76 sm:grid-cols-3">
              {["Facility walkthrough", "Coach guidance", "Plan recommendation"].map((item) => (
                <span className="flex gap-2" key={item}><CheckCircle2 className="text-accent" size={18} /> {item}</span>
              ))}
            </div>
          </div>
          <Card className="p-6">
            <h2 className="text-2xl font-black text-foreground">Reserve your trial</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Our team will confirm your session time and help you prepare for your first visit.</p>
            <div className="mt-6">
              <LazyLeadForm compact type="free_trial" />
            </div>
          </Card>
        </div>
      </section>
      <section className="bg-background py-20 md:py-28">
        <div className="container-page">
          <SectionHeading align="center" eyebrow="What happens next" title="A premium first visit, without pressure." />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {([
              [CalendarCheck, "Reserve a time", "Share your preferred trial date and main fitness goal."],
              [Dumbbell, "Experience the floor", "Explore equipment, programs, coaches, and membership options."],
              [MessageCircle, "Get a clear next step", "The team recommends the right plan, class, or coaching path."]
            ] satisfies Array<[LucideIcon, string, string]>).map(([Icon, title, body]) => (
              <Card className="p-6" key={String(title)}>
                <Icon aria-hidden="true" className="text-secondary" size={26} />
                <h2 className="mt-5 text-xl font-black">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-surface-muted py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <SectionHeading eyebrow="Try a training path" title="Your trial can focus on the goal you care about most." body="Choose from strength, weight loss, muscle building, functional training, HIIT, cross training, yoga, or personal training." />
          <div className="grid gap-3 sm:grid-cols-2">
            {programs.slice(0, 8).map((program) => (
              <div className="rounded-lg border border-border bg-surface p-4 font-bold" key={program.slug}>{program.title}</div>
            ))}
          </div>
        </div>
        <div className="container-page mt-10 text-center">
          <ButtonLink href={whatsappHref} variant="primary">WhatsApp Instead</ButtonLink>
        </div>
      </section>
    </>
  );
}
