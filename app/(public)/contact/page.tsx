import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LazyLeadForm } from "@/features/public/components/lazy-lead-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { siteConfig } from "@/data/site";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Contact Apex Performance Club",
  description: "Contact Apex Performance Club to book a free trial, ask about memberships, call the team, WhatsApp us, email us, or find opening hours and location.",
  path: "/contact"
});

export default function ContactPage() {
  const whatsappHref = `https://wa.me/${siteConfig.whatsapp}?text=${encodeURIComponent("Hi Apex, I want help choosing a membership.")}`;

  return (
    <>
      <section className="bg-obsidian py-20 text-white md:py-28">
        <div className="container-page max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-accent">Contact</p>
          <h1 className="mt-4 text-balance text-5xl font-black leading-tight md:text-7xl">Start with the right plan, not a guess.</h1>
          <p className="mt-6 text-lg leading-8 text-white/70">Tell us what you want to work on and our team will help you choose the right membership, trial session, or coaching path.</p>
        </div>
      </section>
      <section className="bg-background py-20 md:py-28">
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHeading eyebrow="Reach the team" title="Call, message, visit, or send an inquiry." />
            <div className="mt-8 grid gap-4">
              <ContactCard icon={<Phone size={20} />} title="Call" text={siteConfig.phone} href={`tel:${siteConfig.phone.replaceAll(" ", "")}`} />
              <ContactCard icon={<MessageCircle size={20} />} title="WhatsApp" text="Message the front desk" href={whatsappHref} external />
              <ContactCard icon={<Mail size={20} />} title="Email" text={siteConfig.email} href={`mailto:${siteConfig.email}`} />
              <ContactCard icon={<MapPin size={20} />} title="Location" text={siteConfig.address} href="https://maps.google.com" external />
            </div>
            <Card className="mt-6 p-5">
              <h2 className="text-xl font-black">Opening Hours</h2>
              <p className="mt-2 text-muted-foreground">{siteConfig.hours}</p>
            </Card>
          </div>
          <Card className="p-6">
            <h2 className="text-2xl font-black">Send an inquiry</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">The Apex team will contact you with the next step.</p>
            <div className="mt-6">
              <LazyLeadForm type="contact" />
            </div>
          </Card>
        </div>
      </section>
      <section className="bg-surface-muted py-20">
        <div className="container-page">
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="grid min-h-80 place-items-center p-8 text-center">
              <MapPin className="text-secondary" size={34} />
              <h2 className="mt-4 text-3xl font-black">Find Apex in Pune</h2>
              <p className="mt-3 max-w-xl text-muted-foreground">{siteConfig.address}. Use the directions link for the latest route and traffic details.</p>
              <ButtonLink className="mt-6" href="https://maps.google.com" variant="primary">Get Directions</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function ContactCard({ icon, title, text, href, external }: { icon: ReactNode; title: string; text: string; href: string; external?: boolean }) {
  return (
    <a className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 transition hover:border-border-strong hover:bg-surface-muted" href={href} rel={external ? "noreferrer" : undefined} target={external ? "_blank" : undefined}>
      <span className="grid size-11 place-items-center rounded-md bg-surface-muted text-secondary">{icon}</span>
      <span>
        <span className="block text-sm font-black">{title}</span>
        <span className="block text-sm text-muted-foreground">{text}</span>
      </span>
    </a>
  );
}
