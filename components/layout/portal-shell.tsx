"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Lock } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MobileBottomNav, type MobilePortalIconKey } from "@/components/pwa/mobile-bottom-nav";
import { SignOutButton } from "@/components/pwa/sign-out-button";
import PlanStatusBanner from "@/components/ui/PlanStatusBanner";
import { Badge } from "@/components/ui/badge";
import { signOutAction } from "@/features/auth/actions/auth-actions";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";
import { cn } from "@/lib/utils";
import type { AuthContext } from "@/types/auth";
import { ProtectedPageCacheGuard } from "./protected-page-cache-guard";

export type PortalNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  iconKey: MobilePortalIconKey;
  locked?: boolean;
  lockedReason?: string;
};

type PortalShellProps = {
  context: AuthContext;
  title: string;
  eyebrow: string;
  tenantName: string;
  tenantShortName: string;
  tenantInitial: string;
  branchName?: string | null;
  navItems: PortalNavItem[];
  planBannerMode?: "all" | "none" | "suspended-only";
  planContext?: OrgPlanContext | null;
  planManageHref?: string | null;
  showPlanIndicator?: boolean;
  headerActions?: ReactNode;
  children: ReactNode;
};

const packageClasses: Record<string, string> = {
  lite: "border-slate-200 bg-slate-50 text-slate-700",
  standard: "border-indigo-200 bg-indigo-50 text-indigo-700",
  premium: "border-amber-200 bg-amber-50 text-amber-800"
};

export function PortalShell({
  context,
  title,
  eyebrow,
  tenantName,
  tenantShortName,
  tenantInitial,
  branchName,
  navItems,
  planBannerMode = "all",
  planContext,
  planManageHref,
  showPlanIndicator = false,
  headerActions,
  children
}: PortalShellProps) {
  const displayName = context.profile?.full_name || context.email || `${tenantShortName} User`;
  const mobileNavItems = navItems.map(({ href, label, iconKey }) => ({ href, label, iconKey }));
  const showPlanBanner = shouldRenderPlanBanner(planContext, planBannerMode);
  const pathname = usePathname();
  const isActiveItem = useMemo(() => {
    const activeSet = new Set<string>();
    for (const item of navItems) {
      const href = item.href.endsWith("/") ? item.href : item.href + "/";
      if (pathname === item.href || pathname.startsWith(href)) {
        activeSet.add(item.href);
      }
    }
    return (href: string) => activeSet.has(href);
  }, [pathname, navItems]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSidebar(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [sidebarOpen, closeSidebar]);

  return (
    <main className="min-h-screen bg-background text-foreground bg-gradient-mesh">
      <ProtectedPageCacheGuard />

      {/* Mobile sidebar overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink/45 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* Mobile sidebar drawer */}
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/50 glass transition-all duration-300 lg:hidden",
          sidebarOpen ? "translate-x-0 shadow-premium-lg" : "-translate-x-full",
        )}
        role="dialog"
        aria-modal={sidebarOpen}
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between border-b border-border/50 p-4">
          <Link className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.16em] group" href="/" onClick={closeSidebar}>
            <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-accent to-purple-600 text-white shadow-glow transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow-lg">{tenantInitial}</span>
            <span className="gradient-text">{tenantShortName}</span>
          </Link>
          <button
            onClick={closeSidebar}
            className="flex size-11 items-center justify-center rounded-lg hover:bg-surface-muted transition-all duration-200 hover:scale-110"
            aria-label="Close navigation menu"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav aria-label="Portal" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item, index) => (
            item.locked ? (
              <div
                key={`${item.href}-${item.label}`}
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-muted-foreground/50 cursor-not-allowed"
                title={item.lockedReason}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Lock className="size-4 shrink-0" />
                {item.icon}
                {item.label}
              </div>
            ) : (
              <Link
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-all duration-300 card-hover relative overflow-hidden group",
                  isActiveItem(item.href) 
                    ? "bg-gradient-to-r from-accent/10 to-purple-600/10 text-primary shadow-glow-sm" 
                    : "text-muted-foreground hover:bg-surface-muted/80 hover:text-foreground hover:shadow-glow-sm"
                )}
                href={item.href}
                key={`${item.href}-${item.label}`}
                aria-current={isActiveItem(item.href) ? "page" : undefined}
                onClick={closeSidebar}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {isActiveItem(item.href) && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-accent to-purple-600 rounded-r-full" />
                )}
                <span className={cn(
                  "transition-all duration-300",
                  isActiveItem(item.href) ? "scale-110" : "group-hover:scale-110"
                )}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            )
          ))}
        </nav>
        {showPlanIndicator && planContext ? (
          <div className="border-t border-border/50 p-3">
            <PlanIndicator planContext={planContext} planManageHref={planManageHref} />
          </div>
        ) : null}
        <form id="sign-out-form-mobile" action={signOutAction} className="border-t border-border/50 p-3" onClick={closeSidebar}>
          <SignOutButton />
        </form>
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border/50 glass lg:block shadow-premium">
        <div className="flex h-full flex-col">
          <div className="border-b border-border/50 p-6">
            <Link className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.16em] group" href="/">
              <span className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-accent to-purple-600 text-white shadow-glow transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow-lg group-hover:rotate-3">{tenantInitial}</span>
              <span className="gradient-text text-lg">{tenantShortName}</span>
            </Link>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
            {branchName ? <p className="mt-2 text-xs font-semibold text-muted-foreground">{branchName}</p> : null}
          </div>
          <nav aria-label="Portal" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map((item, index) => {
              const active = isActiveItem(item.href);
              if (item.locked) {
                return (
                  <div
                    key={`${item.href}-${item.label}`}
                    className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-muted-foreground/50 cursor-not-allowed"
                    title={item.lockedReason}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <Lock className="size-4 shrink-0" />
                    {item.icon}
                    {item.label}
                  </div>
                );
              }
              return (
                <Link
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-all duration-300 card-hover relative overflow-hidden group animate-fade-in-left",
                    active 
                      ? "bg-gradient-to-r from-accent/10 to-purple-600/10 text-primary shadow-glow-sm" 
                      : "text-muted-foreground hover:bg-surface-muted/80 hover:text-foreground hover:shadow-glow-sm"
                  )}
                  href={item.href}
                  key={`${item.href}-${item.label}`}
                  aria-current={active ? "page" : undefined}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {active && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-accent to-purple-600 rounded-r-full animate-pulse-glow" />
                  )}
                  <span className={cn(
                    "transition-all duration-300",
                    active ? "scale-110 text-accent" : "group-hover:scale-110 group-hover:text-accent"
                  )}>
                    {item.icon}
                  </span>
                  <span className="relative">
                    {item.label}
                    {active && (
                      <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-accent to-purple-600 rounded-full" />
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>
          {showPlanIndicator && planContext ? (
            <div className="border-t border-border/50 p-3">
              <PlanIndicator planContext={planContext} planManageHref={planManageHref} />
            </div>
          ) : null}
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border/50 glass shadow-premium-sm">
          <div className="container-page flex min-h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex size-11 items-center justify-center rounded-lg hover:bg-surface-muted transition-all duration-200 hover:scale-110 lg:hidden"
                aria-label="Open navigation menu"
                aria-expanded={sidebarOpen}
              >
                <Menu className="size-5" />
              </button>
              <div className="animate-fade-in-down">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
                <div className="text-xl font-black md:text-2xl gradient-text">{title}</div>
                <p className="mt-1 text-xs font-semibold text-muted-foreground sm:hidden">{tenantName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 animate-fade-in-right">
              {headerActions}
              {showPlanIndicator && planContext ? (
                <div className="hidden md:block lg:hidden">
                  <PackageBadge packageName={planContext.packageName} />
                </div>
              ) : null}
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-muted-foreground">{tenantName}</p>
                <p className="text-sm font-black gradient-text">{displayName}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{context.primaryRole?.replace("_", " ") ?? "authenticated"}</p>
              </div>
              <form id="sign-out-form-desktop" action={signOutAction} className="lg:hidden">
                <SignOutButton compact />
              </form>
            </div>
          </div>
        </header>
        <div className="container-page space-y-6 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 md:pb-10 md:pt-10 animate-fade-in-up">
          {showPlanBanner && planContext ? <PlanStatusBanner planContext={planContext} /> : null}
          {children}
        </div>
      </div>
      <MobileBottomNav items={mobileNavItems} />
    </main>
  );
}

function PlanIndicator({
  planContext,
  planManageHref
}: {
  planContext: OrgPlanContext;
  planManageHref?: string | null | undefined;
}) {
  const canManage = planContext.status === "active" && !planContext.isTrialing && !planContext.isSuspended && Boolean(planManageHref);

  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Current Plan</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PackageBadge packageName={planContext.packageName} />
        <Badge variant={planContext.isSuspended ? "error" : planContext.isTrialing ? "info" : "neutral"}>
          {planContext.status.replace(/_/g, " ")}
        </Badge>
      </div>
      {canManage && planManageHref ? (
        <Link className="mt-3 inline-flex text-xs font-black text-primary underline-offset-4 hover:underline" href={planManageHref}>
          Manage Plan
        </Link>
      ) : null}
    </div>
  );
}

function PackageBadge({ packageName }: { packageName: string }) {
  const normalizedName = packageName.toLowerCase();

  return (
    <Badge className={cn(packageClasses[normalizedName] ?? "border-border bg-surface-muted text-muted-foreground")}>
      {packageName}
    </Badge>
  );
}

function shouldRenderPlanBanner(planContext: OrgPlanContext | null | undefined, mode: "all" | "none" | "suspended-only") {
  if (!planContext || mode === "none") {
    return false;
  }

  if (mode === "suspended-only") {
    return planContext.isSuspended;
  }

  return true;
}
