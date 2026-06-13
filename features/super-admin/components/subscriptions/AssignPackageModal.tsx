"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { assignPackageAction } from "../../actions/subscription-actions";
import type { OrgSubscriptionSummary, PackageRow, SubscriptionStatus } from "../../services/subscription-service";

type AssignPackageModalProps = {
  organization: OrgSubscriptionSummary;
  packages: PackageRow[];
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-accent";
const statuses: SubscriptionStatus[] = ["active", "trial", "expired", "suspended", "cancelled"];

export function AssignPackageModal({ organization, packages }: AssignPackageModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState(organization.packageId ?? packages[0]?.id ?? "");
  const [status, setStatus] = useState<SubscriptionStatus>(organization.status ?? "active");
  const [expiresAt, setExpiresAt] = useState(formatDateInput(organization.expiresAt));
  const [trialEndsAt, setTrialEndsAt] = useState(formatDateInput(organization.trialEndsAt));
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isDowngrade = useMemo(() => {
    if (!organization.packageId || !selectedPackageId) return false;
    const current = packages.find((p) => p.id === organization.packageId);
    const next = packages.find((p) => p.id === selectedPackageId);
    if (!current || !next) return false;
    return next.sort_order < current.sort_order;
  }, [organization.packageId, selectedPackageId, packages]);

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedPackageId) ?? null,
    [packages, selectedPackageId],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setShowConfirm(false);
    setErrorMessage("");
    triggerRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") close();
    if (e.key === "Tab" && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [close]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    }, 50);
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  function openModal() {
    setSelectedPackageId(organization.packageId ?? packages[0]?.id ?? "");
    setStatus(organization.status ?? "active");
    setExpiresAt(formatDateInput(organization.expiresAt));
    setTrialEndsAt(formatDateInput(organization.trialEndsAt));
    setNotes("");
    setErrorMessage("");
    setShowConfirm(false);
    setIsOpen(true);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");

    if (isDowngrade && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    startTransition(() => {
      void saveAssignment();
    });
  }

  async function saveAssignment() {
    const result = await assignPackageAction({
      organizationId: organization.organizationId,
      packageId: selectedPackageId,
      status,
      expiresAt: toIsoDate(expiresAt),
      trialEndsAt: status === "trial" ? toIsoDate(trialEndsAt) : undefined,
      notes,
    });

    if (result.status === "success") {
      setIsOpen(false);
      setShowConfirm(false);
      setToastMessage(result.message);
      window.setTimeout(() => setToastMessage(""), 3500);
      triggerRef.current?.querySelector("button")?.focus();
      return;
    }

    setErrorMessage(result.message);
  }

  return (
    <>
      <span ref={triggerRef}>
        <Button onClick={openModal} size="sm" variant="secondary" aria-haspopup="dialog">
          {organization.subscriptionId ? "Change Plan" : "Assign Plan"}
        </Button>
      </span>

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[60] max-w-sm animate-in slide-in-from-right-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 shadow-lg dark:border-green-800 dark:bg-green-950 dark:text-green-400" role="status" aria-live="polite">
          {toastMessage}
        </div>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-3 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div
            ref={dialogRef}
            aria-labelledby={titleId}
            aria-modal="true"
            role="dialog"
            className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-lg border border-border bg-surface shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Package Assignment</p>
                <h2 className="mt-1 text-xl font-black sm:text-2xl truncate" id={titleId}>{organization.organizationName}</h2>
                <p className="mt-1 text-sm font-semibold text-muted-foreground truncate">{organization.organizationContact ?? "No billing contact available"}</p>
              </div>
              <Button aria-label="Close package assignment" onClick={close} size="icon" variant="ghost" type="button" className="shrink-0">
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>

            <form className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5" onSubmit={handleSubmit} noValidate>
              {errorMessage ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive" role="alert">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              {showConfirm && isDowngrade ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950" role="alert">
                  <p className="font-bold text-amber-800 dark:text-amber-300">⚠️ Downgrade confirmation required</p>
                  <p className="mt-1 text-amber-700 dark:text-amber-400">
                    You are downgrading this organization&apos;s plan. This may reduce features and limits.
                    The change will take effect at the end of the current billing period.
                  </p>
                  <p className="mt-2 text-amber-700 dark:text-amber-400 font-semibold">Click &quot;Confirm Downgrade&quot; to proceed.</p>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-black" htmlFor={`${titleId}-package`}>Package</label>
                <select
                  className={selectClass}
                  disabled={isPending || packages.length === 0}
                  id={`${titleId}-package`}
                  onChange={(e) => { setSelectedPackageId(e.target.value); setShowConfirm(false); }}
                  value={selectedPackageId}
                  aria-describedby={`${titleId}-package-desc`}
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                  ))}
                </select>
                <p id={`${titleId}-package-desc`} className="text-xs font-semibold text-muted-foreground">
                  {selectedPackage
                    ? `${formatLimit(selectedPackage.max_members, "member", "members")} · ${formatLimit(selectedPackage.max_branches, "branch", "branches")}`
                    : "No active package tiers are available."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-black" htmlFor={`${titleId}-status`}>Status</label>
                  <select
                    className={selectClass}
                    disabled={isPending}
                    id={`${titleId}-status`}
                    onChange={(e) => setStatus(toSubscriptionStatus(e.target.value))}
                    value={status}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>{formatStatus(s)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black" htmlFor={`${titleId}-expires`}>Expiry date</label>
                  <Input
                    disabled={isPending}
                    id={`${titleId}-expires`}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    type="date"
                    value={expiresAt}
                    aria-describedby={`${titleId}-expires-desc`}
                  />
                  <p id={`${titleId}-expires-desc`} className="text-xs font-semibold text-muted-foreground">Leave blank for a subscription that does not expire.</p>
                </div>
              </div>

              {status === "trial" ? (
                <div className="space-y-2">
                  <label className="text-sm font-black" htmlFor={`${titleId}-trial`}>Trial end date</label>
                  <Input
                    disabled={isPending}
                    id={`${titleId}-trial`}
                    onChange={(e) => setTrialEndsAt(e.target.value)}
                    type="date"
                    value={trialEndsAt}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-black" htmlFor={`${titleId}-notes`}>Internal notes</label>
                <Textarea
                  disabled={isPending}
                  id={`${titleId}-notes`}
                  maxLength={500}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional Super Admin note for this package change"
                  value={notes}
                  rows={3}
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <Button disabled={isPending} onClick={close} type="button" variant="secondary" size="lg" className="sm:size-default">
                  Cancel
                </Button>
                <Button disabled={isPending || !selectedPackageId} type="submit" variant="accent" size="lg" className="sm:size-default">
                  {isPending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                  {isPending
                    ? "Saving..."
                    : showConfirm && isDowngrade
                      ? "Confirm Downgrade"
                      : "Save Plan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatLimit(value: number, singular: string, plural: string) {
  if (value === -1) return `Unlimited ${plural}`;
  return `${value.toLocaleString("en-IN")} ${value === 1 ? singular : plural}`;
}

function formatStatus(value: SubscriptionStatus) {
  return value.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

function toSubscriptionStatus(value: string): SubscriptionStatus {
  return statuses.find((s) => s === value) ?? "active";
}

function formatDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function toIsoDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}
