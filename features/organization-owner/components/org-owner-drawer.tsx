"use client";

/* eslint-disable @typescript-eslint/no-require-imports */

import type { ReactNode } from "react";
import { useEffect, useRef, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

type OrgOwnerDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl" | "full";
};

const sizeMap: Record<string, string> = {
  md: "max-w-xl", lg: "max-w-2xl", xl: "max-w-3xl", full: "max-w-4xl"
};

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

export function OrgOwnerDrawer({ open, onClose, title, description, children, size = "lg" }: OrgOwnerDrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);

  // Track whether we've focused for the current open session
  const hasFocusedRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Store the element that triggered the drawer open
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      hasFocusedRef.current = false;
    }
  }, [open]);

  // Focus trap + Escape key + initial auto-focus
  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    if (!container) return;

    // Only auto-focus once per open (not when deps like onClose change)
    if (!hasFocusedRef.current) {
      hasFocusedRef.current = true;
      const firstFocusable = container.querySelector(FOCUSABLE_SELECTOR) as HTMLElement | null;
      const closeButton = container.querySelector('[aria-label="Close drawer"]') as HTMLElement | null;

      requestAnimationFrame(() => {
        (firstFocusable ?? closeButton)?.focus();
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      // Tab trap
      if (e.key === "Tab") {
        const focusableElements = container.querySelectorAll(FOCUSABLE_SELECTOR);
        if (focusableElements.length === 0) return;

        const first = focusableElements[0] as HTMLElement;
        const last = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      // Restore focus to trigger element
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [open]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCloseRef.current();
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      aria-describedby={description ? "drawer-desc" : undefined}
    >
      <div
        ref={containerRef}
        className={`ml-auto flex h-full w-full flex-col overflow-hidden bg-surface shadow-2xl md:m-3 md:h-[calc(100%-1.5rem)] md:w-auto md:rounded-lg md:border md:border-border ${sizeMap[size]}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 md:p-5">
          <div className="min-w-0">
            <h3 id="drawer-title" className="text-lg font-black md:text-2xl">{title}</h3>
            {description ? <p id="drawer-desc" className="mt-0.5 text-xs text-muted-foreground md:mt-1 md:text-sm">{description}</p> : null}
          </div>
          <button
          className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:size-auto md:bg-transparent"
          onClick={() => onCloseRef.current()}
          aria-label="Close drawer"
          type="button"
        >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
        <div className="h-[env(safe-area-inset-bottom)] md:hidden" />
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  children: ReactNode;
  error?: string | null | undefined;
  required?: boolean | undefined;
};

export function DrawerField({ label, children, error, required }: FieldProps) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
        {required ? <span className="ml-1 text-red-500" aria-hidden="true">*</span> : null}
        {required ? <span className="sr-only">(required)</span> : null}
      </label>
      {required ? (
        <div id={id}>{children}</div>
      ) : (
        <div id={id}>{children}</div>
      )}
      {error ? <p className="text-xs font-semibold text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}

export function DrawerSelectField({ defaultValue, label, name, options, required }: {
  defaultValue?: string;
  label: string;
  name: string;
  options: readonly string[] | string[];
  required?: boolean;
}) {
  const { formatEnterpriseLabel } = require("@/features/enterprise/lib/business-rules");
  const id = `field-${name}`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
        {required ? <span className="ml-1 text-red-500" aria-hidden="true">*</span> : null}
      </label>
      <select
        id={id}
        className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        defaultValue={defaultValue}
        name={name}
        required={required}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{formatEnterpriseLabel(opt)}</option>
        ))}
      </select>
    </div>
  );
}

export function DrawerSubmitButton({ children = "Save", loading }: { children?: string; loading?: boolean }) {
  const { pending } = useFormStatus();
  const isBusy = pending || loading;

  return (
    <button
      className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50"
      disabled={isBusy}
      type="submit"
      aria-busy={isBusy}
    >
      {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {isBusy ? "Processing..." : children}
    </button>
  );
}

type DrawerFormMessageProps = {
  status: "idle" | "success" | "error";
  message?: string | null | undefined;
};

export function DrawerFormMessage({ status, message }: DrawerFormMessageProps) {
  if (!message || status === "idle") return null;

  return (
    <div
      className={`rounded-md border p-4 text-sm font-semibold leading-6 ${
        status === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-green-200 bg-green-50 text-green-800"
      }`}
      role="alert"
      aria-live="assertive"
    >
      {message}
    </div>
  );
}

export { useFormStatus };
