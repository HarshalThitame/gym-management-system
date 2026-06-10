import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { programs } from "@/data/site";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Fitness Programs",
  description: "Explore strength training, weight loss, muscle building, functional training, HIIT, cross training, yoga, and personal training at Apex.",
  path: "/programs"
});

export default function ProgramsPage() {
  return (
    <>
      <section className="bg-obsidian py-20 text-white md:py-28">
        <div className="container-page max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">Programs</p>
          <h1 className="mt-4 text-balance text-5xl font-black leading-tight md:text-7xl">Programs built around how real progress happens.</h1>
          <p className="mt-6 text-lg leading-8 text-white/70">Choose focused training paths for strength, conditioning, mobility, personal coaching, and sustainable transformation.</p>
        </div>
      </section>
      <section className="bg-background py-20 md:py-28">
        <div className="container-page grid gap-6">
          {programs.map((program, index) => (
            <Reveal delay={index * 0.03} key={program.slug}>
              <Card className="grid overflow-hidden lg:grid-cols-[0.9fr_1.1fr]" id={program.slug}>
                <div className="relative min-h-72">
                  <Image alt={`${program.title} at Apex`} className="object-cover" fill sizes="(min-width: 1024px) 40vw, 100vw" src={program.image} />
                </div>
                <div className="p-6 md:p-8">
                  <h2 className="text-3xl font-black">{program.title}</h2>
                  <p className="mt-4 text-lg leading-8 text-muted-foreground">{program.description}</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {program.benefits.map((benefit) => (
                      <div className="flex gap-2 text-sm font-semibold" key={benefit}>
                        <Check className="mt-0.5 shrink-0 text-secondary" size={17} /> {benefit}
                      </div>
                    ))}
                  </div>
                  <p className="mt-6 rounded-lg bg-surface-muted p-4 text-sm font-semibold text-muted-foreground">Best for: {program.audience}</p>
                  <ButtonLink className="mt-6" href="/free-trial" variant="accent">
                    {program.cta} <ArrowRight aria-hidden="true" size={18} />
                  </ButtonLink>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="bg-surface-muted py-20">
        <div className="container-page text-center">
          <SectionHeading align="center" title="Not sure where to start?" body="Book a free trial and our team will help you choose the training path that fits your goal, schedule, and starting level." />
          <ButtonLink className="mt-7" href="/free-trial" variant="primary">Book Free Trial</ButtonLink>
        </div>
      </section>
    </>
  );
}

