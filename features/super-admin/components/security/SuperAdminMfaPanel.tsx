"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, LockKeyhole, ShieldAlert, Smartphone, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type MfaFactor = {
  id: string;
  friendly_name?: string | null;
  factor_type?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string | null;
};

type AssuranceLevel = {
  currentLevel: string | null;
  nextLevel: string | null;
};

type SuperAdminMfaPanelProps = {
  currentEmail: string | null;
  requiredEmail: string;
};

const codeInputPattern = "[0-9]*";
const criticalMfaFreshnessCookieName = "super_admin_mfa_verified_at";

export function SuperAdminMfaPanel({ currentEmail, requiredEmail }: SuperAdminMfaPanelProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [assurance, setAssurance] = useState<AssuranceLevel>({ currentLevel: null, nextLevel: null });
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const emailMatches = currentEmail?.trim().toLowerCase() === requiredEmail.toLowerCase();
  const verifiedFactors = factors.filter((factor) => factor.status === "verified");
  const unverifiedFactors = factors.filter((factor) => factor.status !== "verified");
  const primaryFactor = verifiedFactors[0] ?? null;
  const hasExistingFactor = factors.length > 0;

  const refreshState = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [factorResult, assuranceResult] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      ]);

      if (factorResult.error) {
        throw factorResult.error;
      }

      const data = factorResult.data as { totp?: MfaFactor[] } | null;
      setFactors(data?.totp ?? []);
      setAssurance({
        currentLevel: assuranceResult.data?.currentLevel ?? null,
        nextLevel: assuranceResult.data?.nextLevel ?? null
      });
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to load MFA state.");
    } finally {
      setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  async function startEnrollment() {
    if (!emailMatches) {
      setError(`Sign in as ${requiredEmail} before enrolling Super Admin MFA.`);
      return;
    }

    if (hasExistingFactor) {
      setError(null);
      setMessage(verifiedFactors.length > 0
        ? "MFA is already enrolled. Enter the current authenticator code in Critical Action Step-Up to upgrade this session."
        : "An unverified MFA enrollment already exists. Remove the stale factor below, then start enrollment again.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Super Admin Authenticator"
      });

      if (enrollError) {
        throw enrollError;
      }

      const enrollmentData = data as { id?: string; totp?: { qr_code?: string; secret?: string } } | null;
      if (!enrollmentData?.id || !enrollmentData.totp?.qr_code) {
        throw new Error("Supabase did not return a TOTP QR code. Try again.");
      }

      setEnrollment({
        factorId: enrollmentData.id,
        qrCode: enrollmentData.totp.qr_code,
        secret: enrollmentData.totp.secret ?? null
      });
      setMessage("Scan the QR code with an authenticator app, then enter the 6-digit code.");
    } catch (enrollError) {
      if (enrollError instanceof Error && enrollError.message.toLowerCase().includes("already exists")) {
        await refreshState();
        setMessage("MFA is already enrolled. Use Critical Action Step-Up to verify this session.");
        return;
      }
      setError(enrollError instanceof Error ? enrollError.message : "Unable to start MFA enrollment.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyEnrollment() {
    if (!enrollment) {
      setError("Start MFA enrollment before verifying a code.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await challengeAndVerify(enrollment.factorId, enrollCode);
      markCriticalMfaFresh();
      setEnrollment(null);
      setEnrollCode("");
      setMessage("MFA enrolled and verified. Critical Super Admin actions are now protected by a fresh aal2 session.");
      await refreshState();
      router.refresh();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Unable to verify MFA code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyExistingFactor() {
    if (!primaryFactor) {
      setError("No verified TOTP factor exists. Enroll MFA first.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await challengeAndVerify(primaryFactor.id, verifyCode);
      markCriticalMfaFresh();
      setVerifyCode("");
      setMessage("MFA challenge verified. Your current session is upgraded for critical actions for the next 10 minutes.");
      await refreshState();
      router.refresh();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Unable to verify MFA code.");
    } finally {
      setLoading(false);
    }
  }

  async function unenrollFactor(factorId: string) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) {
        throw unenrollError;
      }

      clearCriticalMfaFreshness();
      setMessage("MFA factor removed.");
      await refreshState();
      router.refresh();
    } catch (unenrollError) {
      setError(unenrollError instanceof Error ? unenrollError.message : "Unable to remove MFA factor.");
    } finally {
      setLoading(false);
    }
  }

  async function challengeAndVerify(factorId: string, code: string) {
    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      throw new Error("Enter the 6-digit code from your authenticator app.");
    }

    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      throw challenge.error;
    }

    const challengeData = challenge.data as { id?: string } | null;
    if (!challengeData?.id) {
      throw new Error("Unable to create MFA challenge. Try again.");
    }

    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: trimmedCode
    });

    if (verify.error) {
      throw verify.error;
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <LockKeyhole aria-hidden="true" className="size-5 text-secondary" />
                <h2 className="text-2xl font-black">Super Admin MFA</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Critical organization actions require the signed-in Super Admin to be {requiredEmail} and have an active aal2 MFA session.
              </p>
            </div>
            <Badge variant={assurance.currentLevel === "aal2" ? "success" : "warning"}>
              Current assurance: {assurance.currentLevel ?? "unknown"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!emailMatches ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800">
              Signed in as {currentEmail ?? "unknown user"}. Sign out and sign in as {requiredEmail} before enrolling or verifying Super Admin MFA.
            </div>
          ) : null}
          {message ? <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">{message}</p> : null}
          {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
          {refreshing ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-background p-4 text-sm font-semibold text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Loading MFA state...
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone aria-hidden="true" className="size-5 text-secondary" />
              <h3 className="text-xl font-black">Authenticator Enrollment</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Use Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP-compatible app.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!enrollment ? (
              hasExistingFactor ? (
                <div className="space-y-4">
                  <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm font-semibold leading-6 text-green-800">
                    {verifiedFactors.length > 0
                      ? "Authenticator MFA is already enrolled for this Super Admin account. Use the right panel to verify the current session before critical actions."
                      : "A pending authenticator enrollment already exists. Remove the stale factor below if you need to restart enrollment."}
                  </div>
                  {unverifiedFactors.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm font-black">Pending factors</p>
                      {unverifiedFactors.map((factor) => (
                        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3" key={factor.id}>
                          <div>
                            <p className="text-sm font-bold">{factor.friendly_name || "Authenticator app"}</p>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">Status: {factor.status ?? "pending"}</p>
                          </div>
                          <Button aria-label="Remove pending MFA factor" disabled={loading} onClick={() => void unenrollFactor(factor.id)} size="sm" type="button" variant="secondary">
                            <Trash2 aria-hidden="true" className="size-4" />
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <Button disabled={!emailMatches || loading} onClick={startEnrollment} variant="accent">
                  {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <KeyRound aria-hidden="true" className="size-4" />}
                  Start TOTP Enrollment
                </Button>
              )
            ) : (
              <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <div className="rounded-md border border-border bg-white p-3">
                  <Image alt="TOTP enrollment QR code" className="h-auto w-full" height={196} src={enrollment.qrCode} unoptimized width={196} />
                </div>
                <div className="space-y-4">
                  {enrollment.secret ? (
                    <div>
                      <p className="text-sm font-bold">Manual setup key</p>
                      <p className="mt-2 break-all rounded-md border border-border bg-background p-3 text-sm font-semibold text-muted-foreground">{enrollment.secret}</p>
                    </div>
                  ) : null}
                  <label className="space-y-2 block">
                    <span className="text-sm font-bold">6-digit code</span>
                    <Input
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) => setEnrollCode(event.target.value)}
                      pattern={codeInputPattern}
                      placeholder="123456"
                      value={enrollCode}
                    />
                  </label>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <Button disabled={loading} onClick={() => setEnrollment(null)} type="button" variant="secondary">Cancel</Button>
                    <Button disabled={loading} onClick={verifyEnrollment} type="button">
                      {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="size-4" />}
                      Verify Enrollment
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert aria-hidden="true" className="size-5 text-secondary" />
              <h3 className="text-xl font-black">Critical Action Step-Up</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Verify a current TOTP code before transfer, suspend, delete, or bulk organization operations.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {verifiedFactors.length > 0 ? (
              <>
                <label className="space-y-2 block">
                  <span className="text-sm font-bold">Authenticator code</span>
                  <Input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setVerifyCode(event.target.value)}
                    pattern={codeInputPattern}
                    placeholder="123456"
                    value={verifyCode}
                  />
                </label>
                <Button disabled={!emailMatches || loading} onClick={verifyExistingFactor}>
                  {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <LockKeyhole aria-hidden="true" className="size-4" />}
                  Verify This Session
                </Button>
              </>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
                No verified authenticator factor is enrolled yet. Enroll TOTP before running critical organization actions.
              </div>
            )}
            <div className="space-y-3">
              <p className="text-sm font-black">Verified factors</p>
              {verifiedFactors.length > 0 ? verifiedFactors.map((factor) => (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3" key={factor.id}>
                  <div>
                    <p className="text-sm font-bold">{factor.friendly_name || "Authenticator app"}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">Created {factor.created_at ? new Date(factor.created_at).toLocaleDateString() : "recently"}</p>
                  </div>
                  <Button aria-label="Remove MFA factor" disabled={loading} onClick={() => void unenrollFactor(factor.id)} size="sm" type="button" variant="secondary">
                    <Trash2 aria-hidden="true" className="size-4" />
                    Remove
                  </Button>
                </div>
              )) : (
                <p className="rounded-md border border-border bg-background p-3 text-sm font-semibold text-muted-foreground">No verified MFA factors.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SuperAdminMfaPanel;

function markCriticalMfaFresh() {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${criticalMfaFreshnessCookieName}=${Date.now()}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
}

function clearCriticalMfaFreshness() {
  document.cookie = `${criticalMfaFreshnessCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
}
