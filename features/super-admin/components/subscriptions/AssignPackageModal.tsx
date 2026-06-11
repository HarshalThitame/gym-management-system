"use client";

import { Loader2, X } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { assignPackageAction } from "../../actions/subscription-actions";
import type { OrgSubscriptionSummary, PackageRow, SubscriptionStatus } from "../../services/subscription-service";

type AssignPackageModalProps = {
  organization: OrgSubscriptionSummary;
  packages: PackageRow[];
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";
const statuses: SubscriptionStatus[] = ["active", "trial", "expired", "suspended", "cancelled"];

export function AssignPackageModal({ organization, packages }: AssignPackageModalProps) {
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState(organization.packageId ?? packages[0]?.id ?? "");
  const [status, setStatus] = useState<SubscriptionStatus>(organization.status ?? "active");
  const [expiresAt, setExpiresAt] = useState(formatDateInput(organization.expiresAt));
  const [trialEndsAt, setTrialEndsAt] = useState(formatDateInput(organization.trialEndsAt));
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const selectedPackage = useMemo(
    () => packages.find((packageRow) => packageRow.id === selectedPackageId) ?? null,
    [packages, selectedPackageId]
  );

  function openModal() {
    setSelectedPackageId(organization.packageId ?? packages[0]?.id ?? "");
    setStatus(organization.status ?? "active");
    setExpiresAt(formatDateInput(organization.expiresAt));
    setTrialEndsAt(formatDateInput(organization.trialEndsAt));
    setNotes("");
    setErrorMessage("");
    setIsOpen(true);
  }

  function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

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
      notes
    });

    if (result.status === "success") {
      setIsOpen(false);
      setToastMessage(result.message);
      window.setTimeout(() => setToastMessage(""), 3500);
      return;
    }

    setErrorMessage(result.message);
  }

  return (
    <>
      <Button onClick={openModal} size="sm" variant="secondary">
        {organization.subscriptionId ? "Change Plan" : "Assign Plan"}
      </Button>

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[60] max-w-sm rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 shadow-lg" role="status">
          {toastMessage}
        </div>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4">
          <div aria-labelledby={titleId} aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface shadow-2xl" role="dialog">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Package Assignment</p>
                <h2 className="mt-2 text-2xl font-black" id={titleId}>{organization.organizationName}</h2>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">{organization.organizationContact ?? "No billing contact available"}</p>
              </div>
              <Button aria-label="Close package assignment" onClick={() => setIsOpen(false)} size="icon" variant="ghost">
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>

            <form className="space-y-5 p-5" onSubmit={submitAssignment}>
              {errorMessage ? (
                <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-black" htmlFor={`${titleId}-package`}>Package</label>
                <select
                  className={selectClass}
                  disabled={isPending || packages.length === 0}
                  id={`${titleId}-package`}
                  onChange={(event) => setSelectedPackageId(event.target.value)}
                  value={selectedPackageId}
                >
                  {packages.map((packageRow) => (
                    <option key={packageRow.id} value={packageRow.id}>{packageRow.name}</option>
                  ))}
                </select>
                <p className="text-xs font-semibold text-muted-foreground">
                  {selectedPackage
                    ? `${formatLimit(selectedPackage.max_members, "member", "members")} · ${formatLimit(selectedPackage.max_branches, "branch", "branches")}`
                    : "No active package tiers are available."}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-black" htmlFor={`${titleId}-status`}>Status</label>
                  <select
                    className={selectClass}
                    disabled={isPending}
                    id={`${titleId}-status`}
                    onChange={(event) => setStatus(toSubscriptionStatus(event.target.value))}
                    value={status}
                  >
                    {statuses.map((subscriptionStatus) => (
                      <option key={subscriptionStatus} value={subscriptionStatus}>{formatStatus(subscriptionStatus)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black" htmlFor={`${titleId}-expires`}>Expiry date</label>
                  <Input
                    disabled={isPending}
                    id={`${titleId}-expires`}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    type="date"
                    value={expiresAt}
                  />
                  <p className="text-xs font-semibold text-muted-foreground">Leave blank for a subscription that does not expire.</p>
                </div>
              </div>

              {status === "trial" ? (
                <div className="space-y-2">
                  <label className="text-sm font-black" htmlFor={`${titleId}-trial`}>Trial end date</label>
                  <Input
                    disabled={isPending}
                    id={`${titleId}-trial`}
                    onChange={(event) => setTrialEndsAt(event.target.value)}
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
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional Super Admin note for this package change"
                  value={notes}
                />
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <Button disabled={isPending} onClick={() => setIsOpen(false)} type="button" variant="secondary">
                  Cancel
                </Button>
                <Button disabled={isPending || !selectedPackageId} type="submit" variant="accent">
                  {isPending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                  {isPending ? "Saving" : "Save Plan"}
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
  if (value === -1) {
    return `Unlimited ${plural}`;
  }

  return `${value.toLocaleString("en-IN")} ${value === 1 ? singular : plural}`;
}

function formatStatus(value: SubscriptionStatus) {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function toSubscriptionStatus(value: string): SubscriptionStatus {
  return statuses.find((status) => status === value) ?? "active";
}

function formatDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function toIsoDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}
