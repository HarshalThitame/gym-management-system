"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";

type LeadFormProps = {
  type: "free_trial" | "membership_inquiry" | "contact";
  compact?: boolean;
  defaultInterest?: string;
};

type LeadFormComponent = ComponentType<LeadFormProps>;

export function LazyLeadForm(props: LeadFormProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [Form, setForm] = useState<LeadFormComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    let observer: IntersectionObserver | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const loadForm = () => {
      if (loaded) return;
      loaded = true;
      import("./lead-form")
        .then((module) => {
          if (!cancelled) {
            setForm(() => module.LeadForm);
          }
        })
        .catch(() => undefined);
    };

    const node = containerRef.current;

    if (node && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            loadForm();
          }
        },
        { rootMargin: "240px" }
      );
      observer.observe(node);
    } else {
      loadForm();
    }

    timeoutId = globalThis.setTimeout(loadForm, 9000);

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, []);

  return <div ref={containerRef}>{Form ? <Form {...props} /> : <LeadFormSkeleton compact={props.compact} />}</div>;
}

function LeadFormSkeleton({ compact }: { compact?: boolean | undefined }) {
  return (
    <div aria-hidden="true" className="grid gap-4">
      <div className={compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
        <SkeletonField />
        <SkeletonField />
      </div>
      <div className={compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
        <SkeletonField />
        <SkeletonField />
      </div>
      <div className="h-28 rounded-md border border-border bg-surface-muted" />
      <div className="h-5 w-4/5 rounded bg-border/70" />
      <div className="h-11 rounded-md bg-accent" />
    </div>
  );
}

function SkeletonField() {
  return (
    <div className="grid gap-2">
      <div className="h-4 w-24 rounded bg-border/70" />
      <div className="h-11 rounded-md border border-border bg-surface-muted" />
    </div>
  );
}
