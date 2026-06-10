import type { Metadata } from "next";
import { BlogList } from "@/features/public/components/blog-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { blogPosts } from "@/data/site";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Fitness Blog",
  description: "SEO-friendly fitness, nutrition, weight loss, muscle gain, recovery, and lifestyle articles from the Apex coaching team.",
  path: "/blog"
});

export default function BlogPage() {
  return (
    <>
      <section className="bg-obsidian py-20 text-white md:py-28">
        <div className="container-page max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">Blog</p>
          <h1 className="mt-4 text-balance text-5xl font-black leading-tight md:text-7xl">Smarter training starts with better guidance.</h1>
          <p className="mt-6 text-lg leading-8 text-white/70">Practical fitness, nutrition, weight loss, muscle gain, recovery, and lifestyle articles from the Apex coaching team.</p>
        </div>
      </section>
      <section className="bg-background py-20 md:py-28">
        <div className="container-page">
          <SectionHeading eyebrow="Articles" title="Search training guidance by category or tag." />
          <div className="mt-8">
            <BlogList posts={blogPosts} />
          </div>
        </div>
      </section>
    </>
  );
}

