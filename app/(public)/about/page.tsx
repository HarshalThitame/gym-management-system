import type { Metadata } from "next";
import Image from "next/image";
import { Award, Eye, HeartPulse, ShieldCheck, Target, Users, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { gallery, siteConfig, trainers } from "@/data/site";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "About Apex Performance Club",
  description: "Learn about Apex Performance Club, our mission, values, facilities, coaching standards, certifications, and premium fitness experience.",
  path: "/about"
});

export default function AboutPage() {
  return (
    <>
      <section className="bg-obsidian py-20 text-white md:py-28">
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">About Apex</p>
            <h1 className="mt-4 text-balance text-5xl font-black leading-tight md:text-7xl">
              Designed for focused training and long-term consistency.
            </h1>
            <p className="mt-6 text-lg leading-8 text-white/70">
              Apex combines expert coaching, modern facilities, and clear member support in one polished club experience.
            </p>
          </Reveal>
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
              <Image alt="Apex premium training facility" className="object-cover" fill priority sizes="(min-width: 1024px) 50vw, 100vw" src={gallery[0]?.image ?? ""} />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-background py-20 md:py-28">
        <div className="container-page grid gap-10 lg:grid-cols-3">
          <Reveal>
            <Card className="h-full p-6">
              <Target className="text-secondary" size={28} />
              <h2 className="mt-5 text-2xl font-black">Mission</h2>
              <p className="mt-3 leading-7 text-muted-foreground">To help members train with structure, confidence, and consistency through premium facilities and expert coaching.</p>
            </Card>
          </Reveal>
          <Reveal delay={0.06}>
            <Card className="h-full p-6">
              <Eye className="text-secondary" size={28} />
              <h2 className="mt-5 text-2xl font-black">Vision</h2>
              <p className="mt-3 leading-7 text-muted-foreground">To become the most trusted performance club for people who want serious training without friction or intimidation.</p>
            </Card>
          </Reveal>
          <Reveal delay={0.12}>
            <Card className="h-full p-6">
              <HeartPulse className="text-secondary" size={28} />
              <h2 className="mt-5 text-2xl font-black">Promise</h2>
              <p className="mt-3 leading-7 text-muted-foreground">Every member gets a clean environment, clear membership support, and a team that respects their goals.</p>
            </Card>
          </Reveal>
        </div>
      </section>

      <section className="bg-surface-muted py-20 md:py-28">
        <div className="container-page">
          <Reveal>
            <SectionHeading align="center" eyebrow="Values" title="The standards behind the club." />
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {([
              [ShieldCheck, "Precision", "Clean systems, clear plans, and reliable member operations."],
              [Users, "Coaching", "Guidance, correction, and progression for every training level."],
              [Award, "Excellence", "Premium spaces, professional service, and attention to detail."],
              [HeartPulse, "Consistency", "Practical routines that members can repeat, track, and sustain."]
            ] satisfies Array<[LucideIcon, string, string]>).map(([Icon, title, body]) => (
              <Card className="p-5" key={String(title)}>
                <Icon aria-hidden="true" className="text-secondary" size={24} />
                <h3 className="mt-5 text-lg font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-20 md:py-28">
        <div className="container-page grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <Reveal>
            <SectionHeading eyebrow="Facilities and certifications" title="A professional club experience from the front desk to the training floor." body={`${siteConfig.name} is built around modern equipment, hygienic training spaces, qualified coaches, and member support that makes joining straightforward.`} />
            <ButtonLink className="mt-7" href="/gallery" variant="primary">View Facilities</ButtonLink>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {["ACE and NASM certified coaches", "Strength and conditioning zones", "Functional and mobility training areas", "Member onboarding and plan guidance", "Transparent membership support", "Digital lead and membership workflows"].map((item) => (
              <div className="rounded-lg border border-border bg-surface p-5 font-semibold" key={item}>{item}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-obsidian py-20 text-white md:py-28">
        <div className="container-page">
          <SectionHeading className="[&_h2]:text-white [&_p]:text-white/68" eyebrow="Team" title="Meet the coaches behind the training floor." />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {trainers.map((trainer) => (
              <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5" key={trainer.slug}>
                <h3 className="text-xl font-black">{trainer.name}</h3>
                <p className="mt-1 text-sm text-white/62">{trainer.role}</p>
                <p className="mt-4 text-sm leading-6 text-white/68">{trainer.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
