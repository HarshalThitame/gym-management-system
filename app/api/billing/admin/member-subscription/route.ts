import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { cancelRazorpaySubscription } from "@/features/billing/razorpay/razorpay-service";
import { billingLogger } from "@/features/billing/lib/logger";

export async function POST(request: Request) {
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
    return NextResponse.json({ error: "No gym scope" }, { status: 403 });
  }

  const body = await request.json() as {
    action: "disable";
    memberId: string;
    membershipId: string;
    subscriptionId?: string | null;
  };

  if (body.action !== "disable") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  // Verify the member belongs to the admin's gym
  const { data: member } = await admin
    .from("members")
    .select("id, gym_id")
    .eq("id", body.memberId)
    .maybeSingle() as never as {
    data: { id: string; gym_id: string } | null;
    error: unknown;
  };

  if (!member || member.gym_id !== profile.gym_id) {
    return NextResponse.json({ error: "Member not found in your gym" }, { status: 404 });
  }

  // Cancel Razorpay subscription if exists
  if (body.subscriptionId) {
    const { data: dbSub } = await admin
      .from("member_subscriptions")
      .select("provider_subscription_id")
      .eq("id", body.subscriptionId)
      .maybeSingle() as never as {
      data: { provider_subscription_id: string | null } | null;
      error: unknown;
    };

    if (dbSub?.provider_subscription_id) {
      await cancelRazorpaySubscription(dbSub.provider_subscription_id);
    }

    await admin.from("member_subscriptions").update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    } as never).eq("id", body.subscriptionId);
  }

  await admin.from("memberships").update({
    auto_renew: false,
  } as never).eq("id", body.membershipId);

  billingLogger.info("admin.member-subscription", "Admin disabled auto-renew", {
    adminId: user.id,
    memberId: body.memberId,
    membershipId: body.membershipId,
  });

  return NextResponse.json({ ok: true, message: "Auto-renew disabled" });
}
