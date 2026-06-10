import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { MobileBottomNav } from "@/components/pwa/mobile-bottom-nav";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions/auth-actions";
import type { AuthContext } from "@/types/auth";

type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type PortalShellProps = {
  context: AuthContext;
  title: string;
  eyebrow: string;
  navItems: PortalNavItem[];
  children: ReactNode;
};

export function PortalShell({ context, title, eyebrow, navItems, children }: PortalShellProps) {
  const displayName = context.profile?.full_name || context.email || "Apex User";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border bg-surface lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-border p-6">
            <Link className="text-sm font-black uppercase tracking-[0.2em]" href="/">
              Apex
            </Link>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
          </div>
          <nav aria-label="Portal" className="flex-1 space-y-1 p-3">
            {navItems.map((item) => (
              <Link
                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-bold text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                href={item.href}
                key={`${item.href}-${item.label}`}
              >
                <item.icon aria-hidden="true" className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={signOutAction} className="border-t border-border p-3">
            <Button className="w-full justify-start" type="submit" variant="ghost">
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
          <div className="container-page flex min-h-16 items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
              <h1 className="text-xl font-black md:text-2xl">{title}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-black">{displayName}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{context.primaryRole?.replace("_", " ") ?? "authenticated"}</p>
              </div>
              <form action={signOutAction} className="lg:hidden">
                <Button aria-label="Sign out" size="icon" type="submit" variant="secondary">
                  <LogOut aria-hidden="true" className="size-4" />
                </Button>
              </form>
            </div>
          </div>
        </header>
        <div className="container-page pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 md:pb-10 md:pt-10">{children}</div>
      </div>
      <MobileBottomNav items={navItems} />
    </main>
  );
}
