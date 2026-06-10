import type { Metadata } from "next";
import { Check, CreditCard, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { LazyLeadForm } from "@/features/public/components/lazy-lead-form";
import { faqs, membershipPlans } from "@/data/site";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Membership Plans",
  description: "Compare Monthly, Quarterly, Half-Yearly, and Annual gym memberships at Apex Performance Club with premium facilities and clear benefits.",
  path: "/membership-plans"
});

export default function MembershipPlansPage() {
  return (
    <>
      <section className="bg-obsidian py-20 text-white md:py-28">
        <div className="container-page max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">Membership</p>
          <h1 className="mt-4 text-balance text-5xl font-black leading-tight md:text-7xl">Memberships that match how you train.</h1>
          <p className="mt-6 text-lg leading-8 text-white/70">Transparent plans, simple renewals, flexible options, and a future-ready payment flow built for Razorpay integration.</p>
        </div>
      </section>
      <section className="bg-background py-20 md:py-28">
        <div className="container-page grid gap-5 lg:grid-cols-4">
          {membershipPlans.map((plan, index) => (
            <Reveal delay={index * 0.05} key={plan.slug}>
              <Card className={plan.highlighted ? "h-full border-ink bg-ink p-5 text-white" : "h-full p-5"}>
                {plan.highlighted ? <Badge className="mb-4" variant="premium">Recommended</Badge> : null}
                <h2 className="text-2xl font-black">{plan.name}</h2>
                <p className={plan.highlighted ? "mt-2 text-sm text-white/62" : "mt-2 text-sm text-muted-foreground"}>{plan.bestFor}</p>
                <div className="mt-5">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className={plan.highlighted ? "ml-2 text-sm text-white/55" : "ml-2 text-sm text-muted-foreground"}>/ {plan.duration}</span>
                </div>
                <p className={plan.highlighted ? "mt-4 text-sm leading-6 text-white/68" : "mt-4 text-sm leading-6 text-muted-foreground"}>{plan.description}</p>
                <ul className="mt-6 grid gap-3">
                  {plan.features.map((feature) => (
                    <li className="flex gap-2 text-sm" key={feature}><Check className="mt-0.5 shrink-0 text-secondary" size={16} /> {feature}</li>
                  ))}
                </ul>
                <ButtonLink className="mt-6 w-full" href={`/contact?interest=${plan.slug}`} variant={plan.highlighted ? "accent" : "primary"}>
                  Choose {plan.name}
                </ButtonLink>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="bg-surface-muted py-20 md:py-28">
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHeading eyebrow="Plan comparison" title="Every membership includes the essentials for a premium training experience." />
            <div className="mt-8 grid gap-4">
              {["Modern training floor access", "Member support and receipts", "Free onboarding walkthrough", "Future online payment flow", "Clear renewal support"].map((item) => (
                <div className="flex gap-3 rounded-lg border border-border bg-surface p-4 font-semibold" key={item}><ShieldCheck className="text-secondary" size={20} /> {item}</div>
              ))}
            </div>
          </div>
          <Card className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <CreditCard className="text-secondary" />
              <h2 className="text-2xl font-black">Membership Inquiry</h2>
            </div>
            <LazyLeadForm defaultInterest="Membership plans" type="membership_inquiry" />
          </Card>
        </div>
      </section>
      <section className="bg-background py-20">
        <div className="container-page">
          <SectionHeading align="center" eyebrow="Membership FAQ" title="Clear answers before you join." />
          <div className="mx-auto mt-10 grid max-w-3xl gap-3">
            {faqs.filter((faq) => faq.category === "Membership" || faq.category === "Payments").map((faq) => (
              <details className="rounded-lg border border-border bg-surface p-5" key={faq.question}>
                <summary className="cursor-pointer list-none font-black">{faq.question}</summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
