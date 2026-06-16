"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type MfaFactor = {
  id: string;
  friendly_name?: string | null;
  status?: string | null;
};

type AssuranceLevel = {
  currentLevel: string | null;
  nextLevel: string | null;
};

const codeInputPattern = "[0-9]*";
const criticalMfaFreshnessCookieName = "super_admin_mfa_verified_at";

export function InlineMfaStepUp() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [assurance, setAssurance] = useState<AssuranceLevel>({ currentLevel: null, nextLevel: null });
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const verifiedFactors = factors.filter((factor) => factor.status === "verified");
  const primaryFactor = verifiedFactors[0] ?? null;

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

  async function verifyCurrentSession() {
    if (!primaryFactor) {
      setError("No verified authenticator factor exists. Enroll MFA first.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await challengeAndVerify(primaryFactor.id, code);
      markCriticalMfaFresh();
      setCode("");
      setMessage("MFA verified. You can review approvals for the next 10 minutes.");
      await refreshState();
      router.refresh();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Unable to verify MFA code.");
    } finally {
      setLoading(false);
    }
  }

  async function challengeAndVerify(factorId: string, inputCode: string) {
    const trimmedCode = inputCode.trim();
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
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert aria-hidden="true" className="size-4 text-secondary" />
            <p className="text-sm font-black">MFA Step-Up</p>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Verify your authenticator code here before approving, rejecting, or cancelling requests.
          </p>
        </div>
        <Badge variant={assurance.currentLevel === "aal2" ? "success" : "warning"}>
          Current assurance: {assurance.currentLevel ?? "unknown"}
        </Badge>
      </div>

      {message ? <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}

      {refreshing ? (
        <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Loading MFA state...
        </div>
      ) : primaryFactor ? (
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(180px,260px)_auto_1fr] md:items-end">
          <label className="space-y-2">
            <span className="text-sm font-bold">Authenticator code</span>
            <Input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value)}
              pattern={codeInputPattern}
              placeholder="123456"
              value={code}
            />
          </label>
          <Button disabled={loading} onClick={verifyCurrentSession} type="button">
            {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <LockKeyhole aria-hidden="true" className="size-4" />}
            Verify MFA
          </Button>
          <p className="text-xs font-semibold text-muted-foreground">
            Using {primaryFactor.friendly_name || "Authenticator app"}. Fresh verification lasts 10 minutes.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900 md:flex-row md:items-center md:justify-between">
          <span>No verified authenticator is enrolled for this account yet.</span>
          <ButtonLink href="/super-admin/security/mfa" size="sm" variant="secondary">
            Enroll MFA
          </ButtonLink>
        </div>
      )}
    </div>
  );
}

function markCriticalMfaFresh() {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${criticalMfaFreshnessCookieName}=${Date.now()}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
}
