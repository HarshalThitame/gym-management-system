import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { navItems } from "@/data/site";
import { getTenantSiteConfig } from "@/lib/tenant/site";

export async function Header() {
  const tenantSite = await getTenantSiteConfig();
  const whatsappHref = `https://wa.me/${tenantSite.whatsapp}?text=${encodeURIComponent(`Hi ${tenantSite.shortName}, I want to book a free trial.`)}`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-obsidian/88 text-white backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between">
        <Link aria-label={`${tenantSite.name} home`} className="flex items-center gap-3" href="/">
          <span className="grid size-9 place-items-center rounded-md bg-accent text-sm font-black text-accent-foreground">{tenantSite.brandInitial}</span>
          <span className="hidden text-sm font-bold tracking-wide sm:block">{tenantSite.name}</span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <Link className="text-sm font-medium text-white/78 transition hover:text-white" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ButtonLink href="/login" size="sm" variant="outline">
            Sign In
          </ButtonLink>
          <ButtonLink href="/membership-plans" size="sm" variant="outline">
            Join Now
          </ButtonLink>
          <ButtonLink href="/free-trial" size="sm" variant="accent">
            Free Trial
          </ButtonLink>
        </div>

        <details className="group relative lg:hidden">
          <summary
            aria-label="Toggle mobile menu"
            className="inline-flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-white/20 text-white transition hover:bg-white/10 [&::-webkit-details-marker]:hidden"
          >
            <span aria-hidden="true" className="grid w-5 gap-1">
              <span className="h-0.5 rounded-full bg-white transition group-open:translate-y-1.5 group-open:rotate-45" />
              <span className="h-0.5 rounded-full bg-white transition group-open:opacity-0" />
              <span className="h-0.5 rounded-full bg-white transition group-open:-translate-y-1.5 group-open:-rotate-45" />
            </span>
          </summary>
          <div className="fixed right-4 top-20 z-50 grid w-[min(calc(100vw-2rem),380px)] gap-5 rounded-lg border border-white/12 bg-obsidian p-5 text-white shadow-2xl">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/48">{tenantSite.shortName}</p>
              <p className="mt-1 text-base font-bold">Mobile navigation</p>
            </div>
            <nav className="grid gap-1" aria-label="Mobile navigation">
              {navItems.map((item) => (
                <Link className="rounded-md px-3 py-3 text-lg font-semibold text-white/86 hover:bg-white/10 hover:text-white" href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="grid gap-3 border-t border-white/10 pt-5">
              <ButtonLink href="/login" variant="outline">
                Sign In
              </ButtonLink>
              <ButtonLink href="/free-trial" variant="accent">
                Book Free Trial
              </ButtonLink>
              <ButtonLink href="/membership-plans" variant="outline">
                View Memberships
              </ButtonLink>
              <a className="text-sm text-white/70 underline-offset-4 hover:underline" href={whatsappHref} rel="noreferrer" target="_blank">
                WhatsApp the front desk
              </a>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
