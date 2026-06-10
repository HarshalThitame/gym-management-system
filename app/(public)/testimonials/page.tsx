import type { Metadata } from "next";
import { PlayCircle, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { testimonials } from "@/data/site";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Member Testimonials",
  description: "Read Apex member reviews, success stories, transformation highlights, ratings, and premium gym experiences.",
  path: "/testimonials"
});

export default function TestimonialsPage() {
  return (
    <>
      <section className="bg-obsidian py-20 text-white md:py-28">
        <div className="container-page max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">Social proof</p>
          <h1 className="mt-4 text-balance text-5xl font-black leading-tight md:text-7xl">Real members. Real routines. Real progress.</h1>
          <p className="mt-6 text-lg leading-8 text-white/70">See how members build consistency with coaching, structure, and a premium training environment.</p>
        </div>
      </section>
      <section className="bg-background py-20 md:py-28">
        <div className="container-page">
          <SectionHeading align="center" title="What members say after they start training with structure." />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((item) => (
              <Card className="h-full p-6" key={item.name}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-1 text-amber-500" aria-label={`${item.rating} star review`}>
                    {Array.from({ length: item.rating }).map((_, index) => (
                      <Star aria-hidden="true" fill="currentColor" key={index} size={16} />
                    ))}
                  </div>
                  {item.videoLabel ? <Badge variant="premium"><PlayCircle size={13} /> Video</Badge> : null}
                </div>
                <blockquote className="mt-5 text-lg font-semibold leading-8">“{item.quote}”</blockquote>
                <p className="mt-5 rounded-lg bg-surface-muted p-3 text-sm font-bold text-foreground">{item.result}</p>
                <div className="mt-6 border-t border-border pt-4">
                  <p className="font-black">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.role}</p>
                </div>
              </Card>
            ))}
          </div>
          <div className="mt-12 text-center">
            <ButtonLink href="/free-trial" variant="accent">Start Your Trial</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

