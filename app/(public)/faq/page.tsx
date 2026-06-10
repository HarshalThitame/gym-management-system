import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { FaqGroups } from "@/features/public/components/faq-groups";
import { faqs } from "@/data/site";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Frequently Asked Questions",
  description: "Answers about Apex memberships, payments, classes, trainers, facilities, free trials, and member experience.",
  path: "/faq"
});

export default function FaqPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer
      }
    }))
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <section className="bg-obsidian py-20 text-white md:py-28">
        <div className="container-page max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">FAQ</p>
          <h1 className="mt-4 text-balance text-5xl font-black leading-tight md:text-7xl">Clear answers before your first session.</h1>
          <p className="mt-6 text-lg leading-8 text-white/70">Learn how trials, memberships, payments, classes, trainers, and facilities work.</p>
        </div>
      </section>
      <section className="bg-background py-20 md:py-28">
        <div className="container-page">
          <SectionHeading eyebrow="Questions" title="Browse answers by topic." />
          <div className="mt-8">
            <FaqGroups faqs={faqs} />
          </div>
          <div className="mt-12 rounded-lg bg-obsidian p-8 text-center text-white">
            <h2 className="text-3xl font-black">Still have a question?</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/68">Talk to the Apex team about trials, plans, coaching, or class access.</p>
            <ButtonLink className="mt-6" href="/contact" variant="accent">Talk to Staff</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
