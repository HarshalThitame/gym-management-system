import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { blogPosts } from "@/data/site";
import { createMetadata } from "@/lib/seo/metadata";

type BlogDetailProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((item) => item.slug === slug);

  if (!post) {
    return createMetadata({
      title: "Blog",
      description: "Fitness guidance from Apex Performance Club.",
      path: "/blog"
    });
  }

  return createMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    image: post.image
  });
}

export default async function BlogDetailPage({ params }: BlogDetailProps) {
  const { slug } = await params;
  const post = blogPosts.find((item) => item.slug === slug);

  if (!post) {
    notFound();
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    author: {
      "@type": "Organization",
      name: post.author
    },
    image: post.image
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <article className="bg-background">
        <section className="bg-obsidian py-16 text-white md:py-24">
          <div className="container-page max-w-4xl">
            <Badge variant="premium">{post.category}</Badge>
            <h1 className="mt-5 text-balance text-4xl font-black leading-tight md:text-6xl">{post.title}</h1>
            <p className="mt-5 text-lg leading-8 text-white/70">{post.excerpt}</p>
            <p className="mt-5 text-sm font-semibold text-white/50">{post.author} · {post.readTime} · {new Date(post.publishedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
          </div>
        </section>
        <div className="container-page py-12 md:py-16">
          <div className="relative mb-10 aspect-[16/8] overflow-hidden rounded-lg">
            <Image alt={post.title} className="object-cover" fill priority sizes="100vw" src={post.image} />
          </div>
          <div className="mx-auto max-w-3xl text-lg leading-9 text-foreground">
            {post.content.map((paragraph) => (
              <p className="mb-6" key={paragraph}>{paragraph}</p>
            ))}
            <div className="mt-10 rounded-lg border border-border bg-surface-muted p-6">
              <h2 className="text-2xl font-black">Ready to train with structure?</h2>
              <p className="mt-3 text-base leading-7 text-muted-foreground">Book a free trial and the Apex team will help you choose the right program or membership path.</p>
              <ButtonLink className="mt-5" href="/free-trial" variant="accent">Book Free Trial</ButtonLink>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}

