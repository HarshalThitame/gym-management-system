"use client";

import { Inbox, Search, ShieldOff, Settings, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ButtonLink } from "./button";
import { Card, CardContent } from "./card";

type EmptyStateType = "no_data" | "no_results" | "no_permissions" | "initial_setup";

type EmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type EmptyStateProps = {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: EmptyStateAction;
  helpLink?: string;
  compact?: boolean;
  simple?: boolean;
  text?: string;
};

const defaults: Record<EmptyStateType, { icon: LucideIcon; title: string; description: string }> = {
  no_data: { icon: Inbox, title: "No data yet", description: "Data will appear here once it becomes available." },
  no_results: { icon: Search, title: "No results found", description: "Try adjusting your search or filters to find what you're looking for." },
  no_permissions: { icon: ShieldOff, title: "Access restricted", description: "You don't have permission to view this content. Contact your administrator." },
  initial_setup: { icon: Settings, title: "Getting started", description: "Configure your settings to begin using this feature." }
};

export function EmptyState({ type = "no_data", title, description, icon, action, helpLink, compact = false, simple = false, text }: EmptyStateProps) {
  if (simple) {
    return <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">{text ?? "No data available"}</div>;
  }

  const def = defaults[type];
  const Icon = def.icon;
  const displayTitle = title ?? def.title;
  const displayDescription = description ?? def.description;

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-background p-6 text-center">
        <div className="rounded-full bg-accent/10 p-2 text-muted-foreground">{icon ?? <Icon className="size-5" />}</div>
        <p className="font-semibold text-sm">{displayTitle}</p>
        <p className="text-xs text-muted-foreground max-w-sm">{displayDescription}</p>
        {action && <ActionButton action={action} />}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-8 md:p-12 text-center">
        <div className="rounded-full bg-accent/10 p-4 text-muted-foreground">{icon ?? <Icon className="size-8" />}</div>
        <h3 className="text-xl font-black">{displayTitle}</h3>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">{displayDescription}</p>
        {action && <ActionButton action={action} />}
        {helpLink && (
          <a href={helpLink} className="text-xs font-semibold text-muted-foreground underline hover:text-foreground">
            Learn more about this feature
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function ActionButton({ action }: { action: EmptyStateAction }) {
  if (action.href) {
    return <ButtonLink href={action.href} variant="primary">{action.label}</ButtonLink>;
  }
  return (
    <button onClick={action.onClick} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
      {action.label}
    </button>
  );
}
