"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";

export type DataCardAction = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  disabled?: boolean;
};

export type DataCardSection = {
  label: string;
  value: string | number | null | undefined;
  icon?: ReactNode;
};

export type DataCardProps = {
  id: string;
  title: string;
  subtitle?: string | null | undefined;
  meta?: string | null | undefined;
  badge?: string | null | undefined;
  badgeVariant?: "success" | "warning" | "error" | "neutral" | "info" | "premium" | undefined;
  status?: string | null | undefined;
  selected?: boolean | undefined;
  onSelect?: ((id: string, selected: boolean) => void) | undefined;
  actions?: DataCardAction[] | undefined;
  sections?: DataCardSection[] | undefined;
  children?: ReactNode | undefined;
  avatar?: ReactNode | undefined;
};

export function DataCard({ id, title, subtitle, meta, badge, badgeVariant = "neutral", status, selected = false, onSelect, actions, sections, children, avatar }: DataCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-[0_2px_12px_rgb(17_18_20/0.04)] transition-all hover:border-border-strong">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between md:gap-4 md:p-5">
        <div className="flex flex-1 items-start gap-3 md:gap-4">
          {avatar ? <div className="mt-0.5 shrink-0">{avatar}</div> : null}
          {onSelect ? (
            <input
              aria-label={`Select ${title}`}
              checked={selected}
              className="mt-1 size-4 shrink-0 rounded border-border accent-primary"
              onChange={(e) => onSelect(id, e.target.checked)}
              type="checkbox"
            />
          ) : null}
          <div className="min-w-0 flex-1 space-y-1 md:space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              <h4 className="text-sm font-black leading-tight md:text-base">{title}</h4>
              {badge ? <Badge variant={badgeVariant}>{badge}</Badge> : null}
              {status ? <EnterpriseStatusBadge status={status} /> : null}
            </div>
            {subtitle ? <p className="text-xs font-semibold text-muted-foreground md:text-sm">{subtitle}</p> : null}
            {meta ? <p className="text-xs leading-5 text-muted-foreground">{meta}</p> : null}
          </div>
        </div>

        {actions && actions.length > 0 ? (
          <div className="flex shrink-0 flex-wrap gap-1.5 md:gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:min-h-0 md:py-1.5 disabled:pointer-events-none disabled:opacity-40 ${
                  action.variant === "primary"
                    ? "bg-primary text-primary-foreground shadow-sm hover:-translate-y-0.5"
                    : action.variant === "destructive"
                    ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    : action.variant === "ghost"
                    ? "text-foreground hover:bg-surface-muted"
                    : "border border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-muted"
                }`}
                disabled={action.disabled}
                onClick={action.onClick}
                type="button"
              >
                {action.icon ? <span className="size-3.5 shrink-0">{action.icon}</span> : null}
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {sections && sections.length > 0 ? (
        <div className="border-t border-border px-4 py-3 md:px-5 md:py-4">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:gap-x-6 md:gap-y-3 lg:grid-cols-3 xl:grid-cols-4">
            {sections.map((section) => (
              <div key={section.label} className="flex items-center gap-1.5 md:gap-2">
                {section.icon ? <span className="size-3.5 shrink-0 text-muted-foreground md:size-4">{section.icon}</span> : null}
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground md:text-[11px] md:tracking-[0.1em]">{section.label}</p>
                  <p className="truncate text-xs font-bold md:text-sm">{section.value ?? "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {children ? <div className="border-t border-border px-4 py-3 md:px-5 md:py-4">{children}</div> : null}
    </div>
  );
}
