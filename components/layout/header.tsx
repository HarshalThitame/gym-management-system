"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { navItems, siteConfig } from "@/data/site";
import { ButtonLink } from "@/components/ui/button";

export function Header() {
  const whatsappHref = `https://wa.me/${siteConfig.whatsapp}?text=${encodeURIComponent("Hi Apex, I want to book a free trial.")}`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-obsidian/88 text-white backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between">
        <Link aria-label="Apex Performance Club home" className="flex items-center gap-3" href="/">
          <span className="grid size-9 place-items-center rounded-md bg-accent text-sm font-black text-accent-foreground">A</span>
          <span className="hidden text-sm font-bold tracking-wide sm:block">{siteConfig.name}</span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <Link className="text-sm font-medium text-white/78 transition hover:text-white" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ButtonLink href="/membership-plans" size="sm" variant="outline">
            Join Now
          </ButtonLink>
          <ButtonLink href="/free-trial" size="sm" variant="accent">
            Free Trial
          </ButtonLink>
        </div>

        <Dialog.Root>
          <Dialog.Trigger className="inline-flex size-10 items-center justify-center rounded-md border border-white/20 text-white lg:hidden" aria-label="Open menu">
            <Menu aria-hidden="true" size={20} />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
            <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-[min(88vw,380px)] flex-col bg-obsidian p-6 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-base font-bold">{siteConfig.shortName}</Dialog.Title>
                <Dialog.Close className="grid size-10 place-items-center rounded-md border border-white/15" aria-label="Close menu">
                  <X aria-hidden="true" size={20} />
                </Dialog.Close>
              </div>
              <nav className="mt-8 grid gap-1" aria-label="Mobile navigation">
                {navItems.map((item) => (
                  <Dialog.Close asChild key={item.href}>
                    <Link className="rounded-md px-3 py-3 text-lg font-semibold text-white/86 hover:bg-white/10 hover:text-white" href={item.href}>
                      {item.label}
                    </Link>
                  </Dialog.Close>
                ))}
              </nav>
              <div className="mt-auto grid gap-3 border-t border-white/10 pt-6">
                <Dialog.Close asChild>
                  <ButtonLink href="/free-trial" variant="accent">
                    Book Free Trial
                  </ButtonLink>
                </Dialog.Close>
                <Dialog.Close asChild>
                  <ButtonLink href="/membership-plans" variant="outline">
                    View Memberships
                  </ButtonLink>
                </Dialog.Close>
                <a className="text-sm text-white/70 underline-offset-4 hover:underline" href={whatsappHref} rel="noreferrer" target="_blank">
                  WhatsApp the front desk
                </a>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}

