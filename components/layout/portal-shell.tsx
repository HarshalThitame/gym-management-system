import Link from "next/link";
import type { LucideIcon } from "lucide-react";
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
  icon: LucideIcon;
  iconKey: MobilePortalIconKey;
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
  children
}: PortalShellProps) {
  const displayName = context.profile?.full_name || context.email || `${tenantShortName} User`;
  const mobileNavItems = navItems.map(({ href, label, iconKey }) => ({ href, label, iconKey }));
  const showPlanBanner = shouldRenderPlanBanner(planContext, planBannerMode);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <ProtectedPageCacheGuard />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border bg-surface lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-border p-6">
            <Link className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.16em]" href="/">
              <span className="grid size-9 place-items-center rounded-md bg-accent text-accent-foreground">{tenantInitial}</span>
              <span>{tenantShortName}</span>
            </Link>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
            {branchName ? <p className="mt-2 text-xs font-semibold text-muted-foreground">{branchName}</p> : null}
          </div>
          <nav aria-label="Portal" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
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
          {showPlanIndicator && planContext ? (
            <div className="border-t border-border p-3">
              <PlanIndicator planContext={planContext} planManageHref={planManageHref} />
            </div>
          ) : null}
          <form action={signOutAction} className="border-t border-border p-3">
            <SignOutButton />
          </form>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
          <div className="container-page flex min-h-16 items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
              <h1 className="text-xl font-black md:text-2xl">{title}</h1>
              <p className="mt-1 text-xs font-semibold text-muted-foreground sm:hidden">{tenantName}</p>
            </div>
            <div className="flex items-center gap-3">
              {showPlanIndicator && planContext ? (
                <div className="hidden md:block lg:hidden">
                  <PackageBadge packageName={planContext.packageName} />
                </div>
              ) : null}
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-muted-foreground">{tenantName}</p>
                <p className="text-sm font-black">{displayName}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{context.primaryRole?.replace("_", " ") ?? "authenticated"}</p>
              </div>
              <form action={signOutAction} className="lg:hidden">
                <SignOutButton compact />
              </form>
            </div>
          </div>
        </header>
        <div className="container-page space-y-6 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 md:pb-10 md:pt-10">
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
