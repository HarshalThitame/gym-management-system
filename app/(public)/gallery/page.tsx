import type { Metadata } from "next";
import { GalleryBrowser } from "@/features/public/components/gallery-browser";
import { SectionHeading } from "@/components/ui/section-heading";
import { gallery } from "@/data/site";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Gym Gallery",
  description: "Explore Apex Performance Club's premium interiors, equipment, workouts, group classes, events, and transformation culture.",
  path: "/gallery"
});

export default function GalleryPage() {
  return (
    <>
      <section className="bg-obsidian py-20 text-white md:py-28">
        <div className="container-page max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">Gallery</p>
          <h1 className="mt-4 text-balance text-5xl font-black leading-tight md:text-7xl">See the space before you step in.</h1>
          <p className="mt-6 text-lg leading-8 text-white/70">Explore the training floor, class zones, equipment, events, and premium spaces built for focused performance.</p>
        </div>
      </section>
      <section className="bg-background py-20 md:py-28">
        <div className="container-page">
          <SectionHeading eyebrow="Browse by category" title="A closer look at the Apex training environment." />
          <div className="mt-8">
            <GalleryBrowser items={gallery} />
          </div>
        </div>
      </section>
    </>
  );
}

