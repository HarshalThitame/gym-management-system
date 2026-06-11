import Link from "next/link";
import { Dumbbell, Mail, MapPin, Phone } from "lucide-react";
import { navItems, programs } from "@/data/site";
import { getTenantSiteConfig } from "@/lib/tenant/site";

export async function Footer() {
  const tenantSite = await getTenantSiteConfig();

  return (
    <footer className="bg-obsidian py-14 text-white">
      <div className="container-page grid gap-10 lg:grid-cols-[1.25fr_0.75fr_0.75fr_1fr]">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-accent font-black text-accent-foreground">{tenantSite.brandInitial}</span>
            <span className="font-bold">{tenantSite.name}</span>
          </div>
          <p className="max-w-sm text-sm leading-6 text-white/68">{tenantSite.description}</p>
          <div className="mt-5 flex gap-3">
            {tenantSite.socials.map((social) => (
              <a className="rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-white/78 hover:bg-white/10" href={social.href} key={social.label} rel="noreferrer" target="_blank">
                {social.label}
              </a>
            ))}
          </div>
        </div>

        <FooterColumn title="Quick Links">
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </FooterColumn>

        <FooterColumn title="Programs">
          {programs.slice(0, 6).map((program) => (
            <Link href="/programs" key={program.slug}>
              {program.title}
            </Link>
          ))}
        </FooterColumn>

        <div>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.08em] text-white/50">Contact</h2>
          <div className="grid gap-3 text-sm text-white/72">
            <p className="flex gap-3"><MapPin className="mt-0.5 shrink-0" size={16} /> {tenantSite.address}</p>
            <a className="flex gap-3 hover:text-white" href={`tel:${tenantSite.phone.replaceAll(" ", "")}`}><Phone className="mt-0.5 shrink-0" size={16} /> {tenantSite.phone}</a>
            <a className="flex gap-3 hover:text-white" href={`mailto:${tenantSite.email}`}><Mail className="mt-0.5 shrink-0" size={16} /> {tenantSite.email}</a>
            <p className="flex gap-3"><Dumbbell className="mt-0.5 shrink-0" size={16} /> {tenantSite.hours}</p>
          </div>
        </div>
      </div>
      <div className="container-page mt-10 border-t border-white/10 pt-6 text-xs text-white/48">
        © {new Date().getFullYear()} {tenantSite.name}. All rights reserved.
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.08em] text-white/50">{title}</h2>
      <div className="grid gap-2 text-sm text-white/72 [&_a:hover]:text-white">{children}</div>
    </div>
  );
}
