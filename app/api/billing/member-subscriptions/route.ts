import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAutoBillingStatus, createSubscription, savePaymentMethod, cancelSubscription } from "@/features/billing/services/member-subscription-service";
import { createRazorpayCustomer, createRazorpayPlan, createRazorpaySubscription, cancelRazorpaySubscription, getRazorpayKeyId } from "@/features/billing/razorpay/razorpay-service";
import { billingLogger } from "@/features/billing/lib/logger";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const membershipId = url.searchParams.get("membershipId") || "";

  if (!membershipId) {
    return NextResponse.json({ error: "membershipId is required" }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("member_id")
    .eq("id", membershipId)
    .maybeSingle() as never as {
    data: { member_id: string } | null;
    error: unknown;
  };

  if (!membership || membership.member_id !== user.id) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  const result = await getAutoBillingStatus(user.id, membershipId);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json(result.status);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    action: "setup" | "confirm" | "disable";
    membershipId: string;
    billingPeriod?: string;
    amount?: number;
    providerSubscriptionId?: string;
    providerPaymentId?: string;
    providerCustomerId?: string;
  };

  if (!body.action || !body.membershipId) {
    return NextResponse.json({ error: "action and membershipId are required" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const { data: membership } = await admin
    .from("memberships")
    .select("id, member_id, gym_id, membership_plan_id, auto_renew")
    .eq("id", body.membershipId)
    .maybeSingle() as never as {
    data: { id: string; member_id: string; gym_id: string; membership_plan_id: string; auto_renew: boolean } | null;
    error: unknown;
  };

  if (!membership || membership.member_id !== user.id) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  if (body.action === "disable") {
    const { data: activeSubs } = await admin
      .from("member_subscriptions")
      .select("id, provider_subscription_id")
      .eq("membership_id", body.membershipId)
      .eq("status", "active") as never as {
      data: Array<{ id: string; provider_subscription_id: string | null }> | null;
      error: unknown;
    };

    for (const sub of activeSubs ?? []) {
      if (sub.provider_subscription_id) {
        await cancelRazorpaySubscription(sub.provider_subscription_id);
      }
      await cancelSubscription(sub.id, user.id);
    }

    await admin.from("memberships").update({ auto_renew: false } as never).eq("id", body.membershipId);

    billingLogger.info("member-subscriptions", "Auto-renew disabled", { membershipId: body.membershipId });
    return NextResponse.json({ ok: true, autoRenew: false });
  }

  if (body.action === "setup") {
    if (!body.billingPeriod || !body.amount) {
      return NextResponse.json({ error: "billingPeriod and amount required" }, { status: 400 });
    }

    const { data: profile } = await admin
      .from("members")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .maybeSingle() as never as {
      data: { full_name: string; email: string | null; phone: string } | null;
      error: unknown;
    };

    if (!profile) {
      return NextResponse.json({ error: "Member profile not found" }, { status: 404 });
    }

    const { data: plan } = await admin
      .from("membership_plans")
      .select("name")
      .eq("id", membership.membership_plan_id)
      .maybeSingle() as never as {
      data: { name: string } | null;
      error: unknown;
    };

    const planName = plan?.name || "Membership";

    const customerResult = await createRazorpayCustomer({
      name: profile.full_name,
      email: profile.email || `${user.id}@member.gym`,
      contact: profile.phone,
      notes: { member_id: user.id, gym_id: membership.gym_id },
    });

    if (!customerResult.ok) {
      return NextResponse.json({ error: customerResult.message }, { status: 500 });
    }

    const planResult = await createRazorpayPlan({
      period: body.billingPeriod as "monthly" | "quarterly" | "half_yearly" | "annual",
      amount: body.amount,
      name: `${planName} - ${body.billingPeriod}`,
      notes: { plan_id: membership.membership_plan_id, gym_id: membership.gym_id },
    });

    if (!planResult.ok) {
      return NextResponse.json({ error: planResult.message }, { status: 500 });
    }

    const subResult = await createRazorpaySubscription({
      planId: planResult.data.id,
      customerId: customerResult.data.id,
      totalCount: 12,
      notes: {
        member_id: user.id,
        membership_id: body.membershipId,
        gym_id: membership.gym_id,
      },
    });

    if (!subResult.ok) {
      return NextResponse.json({ error: subResult.message }, { status: 500 });
    }

    const nextCharge = subResult.data.charge_at
      ? new Date(subResult.data.charge_at * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Save the pending subscription in our DB
    await admin.from("member_subscriptions").insert({
      gym_id: membership.gym_id,
      member_id: user.id,
      membership_id: body.membershipId,
      provider: "razorpay",
      provider_subscription_id: subResult.data.id,
      provider_plan_id: planResult.data.id,
      provider_customer_id: customerResult.data.id,
      status: "pending",
      billing_period: body.billingPeriod,
      amount: body.amount,
      currency: "INR",
      next_charge_at: nextCharge,
    } as never);

    billingLogger.info("member-subscriptions", "Subscription setup - awaiting user authorization", {
      membershipId: body.membershipId,
      subscriptionId: subResult.data.id,
    });

    return NextResponse.json({
      ok: true,
      subscriptionId: subResult.data.id,
      providerSubscriptionId: subResult.data.id,
      keyId: getRazorpayKeyId(),
      customerId: customerResult.data.id,
    });
  }

  if (body.action === "confirm") {
    if (!body.providerSubscriptionId) {
      return NextResponse.json({ error: "providerSubscriptionId required" }, { status: 400 });
    }

    const { data: dbSub } = await admin
      .from("member_subscriptions")
      .select("id")
      .eq("membership_id", body.membershipId)
      .eq("provider_subscription_id", body.providerSubscriptionId)
      .eq("status", "pending")
      .maybeSingle() as never as {
      data: { id: string } | null;
      error: unknown;
    };

    if (!dbSub) {
      return NextResponse.json({ error: "Pending subscription not found" }, { status: 404 });
    }

    await admin.from("member_subscriptions").update({
      status: "active",
    } as never).eq("id", dbSub.id);

    await admin.from("memberships").update({
      auto_renew: true,
    } as never).eq("id", body.membershipId);

    if (body.providerPaymentId && body.providerCustomerId) {
      await savePaymentMethod({
        gymId: membership.gym_id,
        memberId: user.id,
        provider: "razorpay",
        providerCustomerId: body.providerCustomerId,
        providerPaymentMethodId: body.providerSubscriptionId,
        paymentType: "card",
        displayName: "Auto-renew card",
        isDefault: true,
      });
    }

    billingLogger.info("member-subscriptions", "Subscription confirmed", {
      membershipId: body.membershipId,
      subscriptionId: body.providerSubscriptionId,
    });

    return NextResponse.json({ ok: true, autoRenew: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
