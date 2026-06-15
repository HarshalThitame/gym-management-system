import { useState, useCallback } from "react";
import { getSupabaseClient } from "@/api/supabase";

interface MfaState {
  enrolled: boolean;
  factors: Array<{ id: string; type: string; name: string }>;
  verifying: boolean;
}

export function useMFA() {
  const [state, setState] = useState<MfaState>({
    enrolled: false,
    factors: [],
    verifying: false,
  });

  const checkEnrollment = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return;

      const factors = (data?.all ?? []).map((f) => ({
        id: f.id,
        type: f.factor_type,
        name: f.friendly_name ?? f.factor_type,
      }));

      setState({
        enrolled: factors.length > 0,
        factors,
        verifying: false,
      });
    } catch {}
  }, []);

  const enroll = useCallback(async (factorType: "totp" | "phone" = "totp"): Promise<{ id?: string; uri?: string } | null> => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType } as any);
      if (error || !data) return null;

      await checkEnrollment();
      return {
        id: data.id,
        uri: (data as any).totp?.qr_code,
      };
    } catch {
      return null;
    }
  }, [checkEnrollment]);

  const verify = useCallback(async (factorId: string, code: string): Promise<boolean> => {
    try {
      setState((s) => ({ ...s, verifying: true }));
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.mfa.challenge({ factorId });
      if (error || !data) return false;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: data.id,
        code,
      });
      return !verifyError;
    } catch {
      return false;
    } finally {
      setState((s) => ({ ...s, verifying: false }));
    }
  }, []);

  const unenroll = useCallback(async (factorId: string): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) return false;

      await checkEnrollment();
      return true;
    } catch {
      return false;
    }
  }, [checkEnrollment]);

  return {
    ...state,
    checkEnrollment,
    enroll,
    verify,
    unenroll,
  };
}
