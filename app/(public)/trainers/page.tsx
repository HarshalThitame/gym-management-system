import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { TrainerDirectory } from "@/features/public/components/trainer-directory";
import { trainers } from "@/data/site";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Expert Trainers",
  description: "Meet Apex trainers specializing in strength training, HIIT, mobility, weight loss, personal training, and transformation coaching.",
  path: "/trainers"
});

export default function TrainersPage() {
  return (
    <>
      <section className="bg-obsidian py-20 text-white md:py-28">
        <div className="container-page max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">Trainers</p>
          <h1 className="mt-4 text-balance text-5xl font-black leading-tight md:text-7xl">Coaching that makes every session count.</h1>
          <p className="mt-6 text-lg leading-8 text-white/70">Meet experienced trainers who bring structure, correction, and accountability to your training.</p>
          <ButtonLink className="mt-8" href="/free-trial" variant="accent">Book a Coach-Led Trial</ButtonLink>
        </div>
      </section>
      <section className="bg-background py-20 md:py-28">
        <div className="container-page">
          <SectionHeading eyebrow="Coach directory" title="Search by specialty, goal, or coach." body="Every Apex trainer brings a clear specialty and a professional coaching standard to the floor." />
          <div className="mt-10">
            <TrainerDirectory trainers={trainers} />
          </div>
        </div>
      </section>
    </>
  );
}

