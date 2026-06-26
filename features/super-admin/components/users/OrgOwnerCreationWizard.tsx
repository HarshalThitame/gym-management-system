"use client";

import React, { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, Loader2, Shuffle, X, Check, Building2, User, CreditCard, ClipboardList } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { InlineMfaStepUp } from "@/features/super-admin/components/security/InlineMfaStepUp";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { createOrgOwnerAction } from "../../actions/org-owner-creation-actions";
import { FormMessage, FieldError } from "@/features/auth/components/form-message";

type Props = {
  criticalSuperAdminEmail: string;
  onClose: () => void;
};

const STEP_LABELS = ["Account", "Organization", "Subscription", "Review"] as const;
const PACKAGE_TIERS = [
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "enterprise", label: "Enterprise" }
] as const;
const BILLING_PERIODS = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" }
] as const;
const TIMEZONES = [
  { value: "Asia/Kolkata", label: "IST — Asia/Kolkata (UTC+5:30)" },
  { value: "Asia/Dubai", label: "GST — Asia/Dubai (UTC+4)" },
  { value: "America/New_York", label: "EST — America/New_York (UTC-5)" },
  { value: "America/Los_Angeles", label: "PST — America/Los_Angeles (UTC-8)" },
  { value: "Europe/London", label: "GMT — Europe/London (UTC+0)" },
  { value: "Asia/Singapore", label: "SGT — Asia/Singapore (UTC+8)" }
] as const;
const CURRENCIES = [
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "SGD", label: "SGD — Singapore Dollar" }
] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function generatePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let result = "";
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  for (let i = 0; i < 16; i++) {
    result += chars[(array[i] ?? 0) % chars.length];
  }
  return result;
}

type FormFieldErrors = Record<string, string[] | undefined>;

function getFieldError(fieldErrors: FormFieldErrors | undefined, field: string): string | undefined {
  return fieldErrors?.[field]?.[0];
}

export function OrgOwnerCreationWizard({ criticalSuperAdminEmail, onClose }: Props) {
  const [state, formAction] = useActionState(createOrgOwnerAction, initialAuthActionState);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgSlugManual, setOrgSlugManual] = useState(false);
  const [orgDescription, setOrgDescription] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");

  const [packageTier, setPackageTier] = useState("growth");
  const [trialDays, setTrialDays] = useState(14);
  const [billingPeriod, setBillingPeriod] = useState("monthly");

  const [confirmation, setConfirmation] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.status === "success" && prevStatusRef.current !== "success") {
      showToast(state.message, "success");
      onClose();
    }
    prevStatusRef.current = state.status;
  }, [state, onClose]);

  useEffect(() => {
    if (state.status === "error" && state.message && !state.fieldErrors) {
      showToast(state.message, "error");
    }
  }, [state]);

  useEffect(() => {
    setSubmitting(false);
  }, [state]);

  const handleOrgNameChange = useCallback((value: string) => {
    setOrgName(value);
    if (!orgSlugManual) {
      setOrgSlug(slugify(value));
    }
  }, [orgSlugManual]);

  const handleOrgSlugChange = useCallback((value: string) => {
    setOrgSlugManual(true);
    setOrgSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }, []);

  const handleAutoGeneratePassword = useCallback(() => {
    setPassword(generatePassword());
  }, []);

  const canProceedStep0 = Boolean(email.trim() && password.trim() && fullName.trim().length >= 2);
  const canProceedStep1 = orgName.trim().length >= 2 && orgSlug.trim().length >= 2;
  const canProceedStep2 = true;
  const canProceedStep3 = confirmation.trim() === "CREATE_ORG_OWNER";

  const stepCanProceed: Record<number, boolean> = {
    0: canProceedStep0,
    1: canProceedStep1,
    2: canProceedStep2,
    3: canProceedStep3
  };

  function nextStep() {
    if (!stepCanProceed[currentStep]) return;
    if (currentStep < 3) setCurrentStep((s) => s + 1);
  }

  function prevStep() {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!canProceedStep3) {
      e.preventDefault();
      return;
    }
    setSubmitting(true);
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        className="relative flex h-full max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 bg-background/90 backdrop-blur border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Building2 aria-hidden="true" className="size-5 text-secondary" />
            <h2 className="text-lg font-black">Create Organization Owner</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-surface-muted transition" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-background/50 shrink-0">
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && <ArrowRight aria-hidden="true" className="size-3 text-muted-foreground" />}
              <span
                className={`text-xs font-black uppercase tracking-[0.12em] transition-colors ${
                  currentStep === i ? "text-secondary" : currentStep > i ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </React.Fragment>
          ))}
        </div>

        <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <input type="hidden" name="stepUpEmail" value={criticalSuperAdminEmail} />
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="password" value={password} />
          <input type="hidden" name="fullName" value={fullName} />
          <input type="hidden" name="phone" value={phone} />
          <input type="hidden" name="orgName" value={orgName} />
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="orgDescription" value={orgDescription} />
          <input type="hidden" name="timezone" value={timezone} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="packageTier" value={packageTier} />
          <input type="hidden" name="trialDays" value={trialDays} />
          <input type="hidden" name="billingPeriod" value={billingPeriod} />
          <input type="hidden" name="confirmation" value={confirmation} />

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {state.message && !state.fieldErrors && state.status !== "idle" && (
              <FormMessage state={state} />
            )}

            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User aria-hidden="true" className="size-4 text-secondary" />
                  <h3 className="text-sm font-black uppercase tracking-[0.12em]">Account Details</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter the credentials for the new organization owner account.
                </p>

                <label className="space-y-1.5 block">
                  <span className="text-sm font-bold">Email</span>
                  <Input
                    name="email-field"
                    type="email"
                    autoComplete="email"
                    placeholder="owner@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <FieldError message={getFieldError(state.fieldErrors, "email")} />
                </label>

                <label className="space-y-1.5 block">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">Password</span>
                    <button
                      type="button"
                      onClick={handleAutoGeneratePassword}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
                    >
                      <Shuffle aria-hidden="true" className="size-3" />
                      Auto-generate
                    </button>
                  </div>
                  <Input
                    name="password-field"
                    type="text"
                    autoComplete="new-password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <FieldError message={getFieldError(state.fieldErrors, "password")} />
                </label>

                <label className="space-y-1.5 block">
                  <span className="text-sm font-bold">Full Name</span>
                  <Input
                    name="fullName-field"
                    type="text"
                    autoComplete="name"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                  <FieldError message={getFieldError(state.fieldErrors, "fullName")} />
                </label>

                <label className="space-y-1.5 block">
                  <span className="text-sm font-bold">Phone (optional)</span>
                  <Input
                    name="phone-field"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <FieldError message={getFieldError(state.fieldErrors, "phone")} />
                </label>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 aria-hidden="true" className="size-4 text-secondary" />
                  <h3 className="text-sm font-black uppercase tracking-[0.12em]">Organization Details</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configure the new organization&apos;s identity and locale settings.
                </p>

                <label className="space-y-1.5 block">
                  <span className="text-sm font-bold">Organization Name</span>
                  <Input
                    name="orgName-field"
                    type="text"
                    placeholder="Acme Fitness"
                    value={orgName}
                    onChange={(e) => handleOrgNameChange(e.target.value)}
                  />
                  <FieldError message={getFieldError(state.fieldErrors, "orgName")} />
                </label>

                <label className="space-y-1.5 block">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">Slug</span>
                    {orgSlug && orgSlugManual && (
                      <button
                        type="button"
                        onClick={() => { setOrgSlugManual(false); setOrgSlug(slugify(orgName)); }}
                        className="text-xs font-semibold text-secondary hover:underline"
                      >
                        Reset to auto
                      </button>
                    )}
                  </div>
                  <Input
                    name="orgSlug-field"
                    type="text"
                    placeholder="acme-fitness"
                    value={orgSlug}
                    onChange={(e) => handleOrgSlugChange(e.target.value)}
                  />
                  <FieldError message={getFieldError(state.fieldErrors, "orgSlug")} />
                  <p className="text-xs text-muted-foreground">
                    Used in URLs. Lowercase letters, numbers and hyphens only.
                  </p>
                </label>

                <label className="space-y-1.5 block">
                  <span className="text-sm font-bold">Description (optional)</span>
                  <Textarea
                    name="orgDescription-field"
                    placeholder="Brief description of the organization..."
                    value={orgDescription}
                    onChange={(e) => setOrgDescription(e.target.value)}
                    className="min-h-24"
                  />
                  <FieldError message={getFieldError(state.fieldErrors, "orgDescription")} />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="space-y-1.5 block">
                    <span className="text-sm font-bold">Timezone</span>
                    <select
                      name="timezone-field"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm transition focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5 block">
                    <span className="text-sm font-bold">Currency</span>
                    <select
                      name="currency-field"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm transition focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CreditCard aria-hidden="true" className="size-4 text-secondary" />
                  <h3 className="text-sm font-black uppercase tracking-[0.12em]">Subscription Plan</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Select the package tier and billing configuration.
                </p>

                <fieldset>
                  <legend className="text-sm font-bold mb-3">Package Tier</legend>
                  <div className="grid grid-cols-3 gap-3">
                    {PACKAGE_TIERS.map((tier) => (
                      <label
                        key={tier.value}
                        className={`cursor-pointer rounded-lg border-2 p-4 text-center transition-all ${
                          packageTier === tier.value
                            ? "border-secondary bg-secondary/5 shadow-sm"
                            : "border-border hover:border-border-strong"
                        }`}
                      >
                        <input
                          type="radio"
                          name="packageTier-field"
                          value={tier.value}
                          checked={packageTier === tier.value}
                          onChange={(e) => setPackageTier(e.target.value)}
                          className="sr-only"
                        />
                        <span className="text-sm font-black uppercase">{tier.label}</span>
                        {packageTier === tier.value && (
                          <Check aria-hidden="true" className="size-4 text-secondary mx-auto mt-1" />
                        )}
                      </label>
                    ))}
                  </div>
                  <FieldError message={getFieldError(state.fieldErrors, "packageTier")} />
                </fieldset>

                <label className="space-y-1.5 block">
                  <span className="text-sm font-bold">Trial Days</span>
                  <Input
                    name="trialDays-field"
                    type="number"
                    min={0}
                    max={365}
                    placeholder="14"
                    value={trialDays}
                    onChange={(e) => setTrialDays(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
                  />
                  <FieldError message={getFieldError(state.fieldErrors, "trialDays")} />
                  <p className="text-xs text-muted-foreground">Set 0 for no trial period.</p>
                </label>

                <fieldset>
                  <legend className="text-sm font-bold mb-3">Billing Period</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {BILLING_PERIODS.map((period) => (
                      <label
                        key={period.value}
                        className={`cursor-pointer rounded-lg border-2 p-3 text-center transition-all ${
                          billingPeriod === period.value
                            ? "border-secondary bg-secondary/5 shadow-sm"
                            : "border-border hover:border-border-strong"
                        }`}
                      >
                        <input
                          type="radio"
                          name="billingPeriod-field"
                          value={period.value}
                          checked={billingPeriod === period.value}
                          onChange={(e) => setBillingPeriod(e.target.value)}
                          className="sr-only"
                        />
                        <span className="text-sm font-bold">{period.label}</span>
                        {billingPeriod === period.value && (
                          <Check aria-hidden="true" className="size-4 text-secondary mx-auto mt-1" />
                        )}
                      </label>
                    ))}
                  </div>
                  <FieldError message={getFieldError(state.fieldErrors, "billingPeriod")} />
                </fieldset>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ClipboardList aria-hidden="true" className="size-4 text-secondary" />
                  <h3 className="text-sm font-black uppercase tracking-[0.12em]">Review &amp; Confirm</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Verify all details below. This action will create the user, organization, and subscription.
                </p>

                <div className="rounded-lg border border-border bg-background/50 divide-y divide-border">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User aria-hidden="true" className="size-4 text-muted-foreground" />
                      <h4 className="text-sm font-black uppercase tracking-[0.12em]">Account</h4>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <dt className="text-muted-foreground font-medium">Email</dt>
                      <dd className="font-semibold text-foreground truncate">{email || "—"}</dd>
                      <dt className="text-muted-foreground font-medium">Full Name</dt>
                      <dd className="font-semibold text-foreground">{fullName || "—"}</dd>
                      <dt className="text-muted-foreground font-medium">Phone</dt>
                      <dd className="font-semibold text-foreground">{phone || "—"}</dd>
                      <dt className="text-muted-foreground font-medium">Password</dt>
                      <dd className="font-semibold text-foreground font-mono text-xs">{password ? "••••••••" : "—"}</dd>
                    </dl>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 aria-hidden="true" className="size-4 text-muted-foreground" />
                      <h4 className="text-sm font-black uppercase tracking-[0.12em]">Organization</h4>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <dt className="text-muted-foreground font-medium">Name</dt>
                      <dd className="font-semibold text-foreground">{orgName || "—"}</dd>
                      <dt className="text-muted-foreground font-medium">Slug</dt>
                      <dd className="font-semibold text-foreground font-mono text-xs">{orgSlug || "—"}</dd>
                      <dt className="text-muted-foreground font-medium">Timezone</dt>
                      <dd className="font-semibold text-foreground">{TIMEZONES.find((t) => t.value === timezone)?.label ?? timezone}</dd>
                      <dt className="text-muted-foreground font-medium">Currency</dt>
                      <dd className="font-semibold text-foreground">{currency}</dd>
                    </dl>
                    {orgDescription && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <dt className="text-sm text-muted-foreground font-medium mb-1">Description</dt>
                        <dd className="text-sm text-foreground">{orgDescription}</dd>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard aria-hidden="true" className="size-4 text-muted-foreground" />
                      <h4 className="text-sm font-black uppercase tracking-[0.12em]">Subscription</h4>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <dt className="text-muted-foreground font-medium">Package</dt>
                      <dd className="font-semibold text-foreground">
                        <Badge variant="premium">{packageTier}</Badge>
                      </dd>
                      <dt className="text-muted-foreground font-medium">Trial</dt>
                      <dd className="font-semibold text-foreground">{trialDays} day{trialDays !== 1 ? "s" : ""}</dd>
                      <dt className="text-muted-foreground font-medium">Billing</dt>
                      <dd className="font-semibold text-foreground capitalize">{billingPeriod}</dd>
                    </dl>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background/50 p-4">
                  <InlineMfaStepUp compact />
                </div>

                <label className="space-y-1.5 block">
                  <span className="text-sm font-bold">Type CREATE_ORG_OWNER to confirm</span>
                  <Input
                    name="confirmation-field"
                    type="text"
                    autoComplete="off"
                    placeholder="CREATE_ORG_OWNER"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                  <FieldError message={getFieldError(state.fieldErrors, "confirmation")} />
                </label>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-border bg-background/50 flex items-center justify-between shrink-0">
            <Button onClick={onClose} variant="secondary" type="button">
              Cancel
            </Button>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button onClick={prevStep} variant="secondary" type="button">
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Back
                </Button>
              )}
              {currentStep < 3 ? (
                <Button onClick={nextStep} variant="primary" type="button" disabled={!stepCanProceed[currentStep]}>
                  Next
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!canProceedStep3 || submitting}
                  variant="primary"
                >
                  {submitting ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <Check aria-hidden="true" className="size-4" />
                  )}
                  Create Org Owner
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
