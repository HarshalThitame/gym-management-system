import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { listGymProviders, upsertGymProviderConfig } from "@/features/billing/providers/provider-config-service";
import { clearProviderCache } from "@/features/billing/providers/provider-registry";
import { billingLogger } from "@/features/billing/lib/logger";
import type { PaymentProviderName } from "@/features/billing/providers/provider-types";

const ALLOWED_PROVIDERS: PaymentProviderName[] = ["razorpay", "payu"];

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id")
    .eq("id", user.id)
    .maybeSingle() as never as {
    data: { gym_id: string | null } | null;
    error: unknown;
  };

  if (!profile?.gym_id) {
    return NextResponse.json({ error: "No gym scope assigned" }, { status: 403 });
  }

  const result = await listGymProviders(profile.gym_id);
  if (!result.ok) {
    return NextResponse.json({ providers: [] });
  }

  return NextResponse.json({ providers: result.providers });
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id")
    .eq("id", user.id)
    .maybeSingle() as never as {
    data: { gym_id: string | null } | null;
    error: unknown;
  };

  if (!profile?.gym_id) {
    return NextResponse.json({ error: "No gym scope assigned" }, { status: 403 });
  }

  const body = await request.json() as {
    provider: string;
    isActive: boolean;
    isDefault: boolean;
    priority: number;
    testMode: boolean;
    supportedPaymentTypes?: string[];
    config: Record<string, string>;
  };

  if (!body.provider || !ALLOWED_PROVIDERS.includes(body.provider as PaymentProviderName)) {
    return NextResponse.json({ error: `Invalid provider. Must be one of: ${ALLOWED_PROVIDERS.join(", ")}` }, { status: 400 });
  }

  const result = await upsertGymProviderConfig(
    profile.gym_id,
    body.provider as PaymentProviderName,
    {
      isActive: body.isActive,
      isDefault: body.isDefault,
      priority: body.priority,
      testMode: body.testMode,
      config: body.config,
      supportedPaymentTypes: body.supportedPaymentTypes ?? ["card", "upi", "net_banking"],
    },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  clearProviderCache();

  billingLogger.info("provider-config", "Provider config updated", {
    gymId: profile.gym_id,
    provider: body.provider,
  });

  return NextResponse.json({ ok: true, message: result.message });
}
