import type { Metadata } from "next";
import { Activity, CreditCard, Shield, Sparkles, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ProviderConfigForm } from "@/features/billing/components/provider-config-form";
import { PaymentGatewayTestButton } from "@/features/billing/components/payment-gateway-test-button";
import { maskRazorpayKey } from "@/features/billing/razorpay/razorpay-config";
import { resolvePlatformRazorpayCredentials } from "@/features/billing/razorpay/platform-razorpay-config";
import { preflightRazorpayCredentials } from "@/features/billing/razorpay/razorpay-service";
import { RazorpayStandardCheckoutButton } from "@/features/billing/components/razorpay-standard-checkout-button";
import { listPlatformProviders } from "@/features/billing/services/platform-provider-config-service";

export const metadata: Metadata = createMetadata({
  title: "Platform Payment Gateways",
  description: "Configure the platform payment gateway used for organization plan billing.",
  path: "/super-admin/payment-gateways",
});

export const dynamic = "force-dynamic";

export default async function SuperAdminPaymentGatewaysPage() {
  await requireRole(["super_admin"], "/super-admin/payment-gateways");

  const result = await listPlatformProviders();
  const providers = result.ok ? result.providers : [];
  const razorpayConfig = providers.find((p) => p.provider === "razorpay");
  const payuConfig = providers.find((p) => p.provider === "payu");
  const activeProviders = providers.filter((p) => p.isActive);
  const defaultProvider = providers.find((p) => p.isDefault)?.provider ?? "none";
  const liveProviders = providers.filter((p) => !p.testMode).length;
  const platformCredentials = await resolvePlatformRazorpayCredentials();
  const platformAuthPreflight = platformCredentials ? await preflightRazorpayCredentials(platformCredentials) : null;
  const platformSource = razorpayConfig?.isActive ? "Platform table" : "Env fallback";
  const platformMode = platformCredentials?.environment ?? "test";
  const preflightState = platformAuthPreflight
    ? (platformAuthPreflight.ok ? "Auth valid" : "Auth invalid")
    : "Not tested";
  const preflightVariant = platformAuthPreflight?.ok ? "success" : "warning";
  const supabase = getSupabaseAdminClient();
  const healthSince = new Date();
  healthSince.setDate(healthSince.getDate() - 7);

  const [paymentProviderEvents, subscriptionPaymentRows, paymentAttemptRows] = supabase
    ? await Promise.all([
        supabase
          .from("payment_provider_events")
          .select("event_id, event_type, status, error_message, processed_at, created_at, provider, provider_environment")
          .gte("created_at", healthSince.toISOString())
          .order("created_at", { ascending: false })
          .limit(24),
        supabase
          .from("org_subscription_payments")
          .select("id, status, failure_reason, provider, provider_environment, created_at, paid_at")
          .gte("created_at", healthSince.toISOString())
          .order("created_at", { ascending: false })
          .limit(24),
        supabase
          .from("payment_attempts")
          .select("id, status, attempt_type, error_description, error_code, provider, provider_order_id, provider_payment_id, created_at")
          .gte("created_at", healthSince.toISOString())
          .order("created_at", { ascending: false })
          .limit(48),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const healthErrors = [paymentProviderEvents, subscriptionPaymentRows, paymentAttemptRows].find((result) => result.error)?.error;
  if (healthErrors) {
    console.error("[super-admin-payment-gateways] Health query failed.", healthErrors.message);
  }

  const providerEvents = paymentProviderEvents.data ?? [];
  const subscriptionPayments = subscriptionPaymentRows.data ?? [];
  const paymentAttempts = paymentAttemptRows.data ?? [];
  const failedProviderEvents = providerEvents.filter((event) => event.status === "failed");
  const pendingWebhookPayments = subscriptionPayments.filter((payment) => payment.status === "awaiting_webhook" || payment.status === "processing");
  const retryBacklog = paymentAttempts.filter((attempt) => attempt.status === "failed" || attempt.status === "retrying" || attempt.status === "processing" || attempt.status === "created");
  const latestFailureRecord = [
    ...failedProviderEvents.map((event) => ({ kind: "provider_event" as const, message: event.error_message, createdAt: event.created_at })),
    ...paymentAttempts.filter((attempt) => attempt.status === "failed").map((attempt) => ({ kind: "attempt" as const, message: attempt.error_description ?? attempt.error_code, createdAt: attempt.created_at })),
    ...subscriptionPayments.filter((payment) => payment.status === "failed").map((payment) => ({ kind: "subscription_payment" as const, message: payment.failure_reason, createdAt: payment.created_at })),
  ]
    .filter((row) => Boolean(row.message))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Badge variant="member-info" className="w-fit gap-1.5 border-white/20 text-white">
              <Sparkles className="size-3.5" />
              Super Admin only
            </Badge>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Platform billing</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Organization Plan Gateways</h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/72">
                Configure the payment provider used only for SaaS organization plans. Member membership gateways remain organization-scoped and are managed separately.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">Active gateways</p>
              <p className="mt-2 text-3xl font-black">{activeProviders.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">Default provider</p>
              <p className="mt-2 text-2xl font-black capitalize">{defaultProvider}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">Live mode</p>
              <p className="mt-2 text-3xl font-black">{liveProviders}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="elevated" className="border-border/70">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
              <CreditCard className="size-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Scope</p>
              <p className="mt-1 text-lg font-black">Org-plan billing only</p>
              <p className="text-sm text-muted-foreground">This config powers super-admin SaaS plan purchases and renewals.</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="border-border/70">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <Activity className="size-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Safety</p>
              <p className="mt-1 text-lg font-black">Separate from gym billing</p>
              <p className="text-sm text-muted-foreground">Member membership gateways remain under the gym/admin payment settings.</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="border-border/70">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
              <WalletCards className="size-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Fallback</p>
              <p className="mt-1 text-lg font-black">Env-compatible</p>
              <p className="text-sm text-muted-foreground">If not configured here, the platform falls back to existing Razorpay env vars.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card variant="elevated" className="border-border/70">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-muted-foreground" />
            <h3 className="text-xl font-black">Runtime Billing Health</h3>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Provider events</p>
            <p className="mt-2 text-2xl font-black">{providerEvents.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{failedProviderEvents.length} failed in the last 7 days</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Webhook backlog</p>
            <p className="mt-2 text-2xl font-black">{pendingWebhookPayments.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Payments awaiting webhook confirmation</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Retry queue</p>
            <p className="mt-2 text-2xl font-black">{retryBacklog.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Attempts needing another pass</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Health readout</p>
            <p className="mt-2 text-sm font-black">{healthErrors ? "Query error" : failedProviderEvents.length === 0 && pendingWebhookPayments.length === 0 && retryBacklog.length === 0 ? "Healthy" : "Needs attention"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {latestFailureRecord?.message ? String(latestFailureRecord.message) : "No recent failure messages recorded."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.5)]">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="member-info" className="border-white/20 text-white">
                  Platform billing health
                </Badge>
                <Badge variant={platformCredentials ? "success" : "warning"} className="border-white/20">
                  {platformCredentials ? "Configured" : "Missing"}
                </Badge>
              </div>
              <h3 className="text-xl font-black">Org-plan gateway health</h3>
              <p className="text-sm text-white/68">
                This reflects the credential source used by the super-admin org-plan checkout, retries, and webhook verification.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">Runtime source</p>
              <p className="mt-1 text-lg font-black">{platformSource}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">Auth preflight</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={preflightVariant} className="border-white/20">
                  {preflightState}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">Provider</p>
            <p className="mt-2 text-lg font-black">{platformCredentials ? "Razorpay" : "Not configured"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">Environment</p>
            <p className="mt-2 text-lg font-black capitalize">{platformMode}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">Key ID</p>
            <p className="mt-2 text-lg font-black">{platformCredentials ? maskRazorpayKey(platformCredentials.keyId) : "—"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/55">Fallback</p>
            <p className="mt-2 text-lg font-black">{razorpayConfig?.isActive ? "Disabled" : "Env active"}</p>
          </div>
        </CardContent>
        {platformAuthPreflight && !platformAuthPreflight.ok && (
          <CardContent className="pt-0">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-white/88">
              <p className="font-black">Razorpay auth preflight failed</p>
              <p className="mt-1 text-white/74">{platformAuthPreflight.message}</p>
            </div>
          </CardContent>
        )}
      </Card>

      <RazorpayStandardCheckoutButton
        title="Org Plan Standard Checkout"
        description="Test the full Razorpay Standard Checkout flow for org-plan billing with server-side order creation and signature verification."
        buttonLabel="Launch Razorpay Checkout"
        defaultAmountRupees={499}
        defaultReceipt={`org-standard-${new Date().toISOString().slice(0, 10)}`}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100">
                <CreditCard className="size-5 text-blue-700" />
              </div>
              <div>
                <h3 className="text-xl font-black">Razorpay</h3>
                <p className="text-sm text-muted-foreground">{razorpayConfig?.isActive ? "Active" : "Not configured"}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ProviderConfigForm
              provider="razorpay"
              initialConfig={razorpayConfig?.config ?? {}}
              isActive={razorpayConfig?.isActive ?? false}
              isDefault={razorpayConfig?.isDefault ?? false}
              priority={razorpayConfig?.priority ?? 0}
              testMode={razorpayConfig?.testMode ?? true}
              saveEndpoint="/api/super-admin/payment-gateway-config"
              successLabel="Platform Razorpay configuration saved"
              configFields={[
                { key: "key_id", label: "Key ID", type: "text", required: true, placeholder: "rzp_live_..." },
                { key: "key_secret", label: "Key Secret", type: "password", required: true, placeholder: "Enter secret key" },
                { key: "webhook_secret", label: "Webhook Secret", type: "password", required: true, placeholder: "Enter webhook secret" },
              ]}
            />
            <div className="mt-5">
              <PaymentGatewayTestButton provider="razorpay" label="Test integration" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100">
                <Shield className="size-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-xl font-black">PayU</h3>
                <p className="text-sm text-muted-foreground">{payuConfig?.isActive ? "Configured" : "Optional"}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ProviderConfigForm
              provider="payu"
              initialConfig={payuConfig?.config ?? {}}
              isActive={payuConfig?.isActive ?? false}
              isDefault={payuConfig?.isDefault ?? false}
              priority={payuConfig?.priority ?? 1}
              testMode={payuConfig?.testMode ?? true}
              saveEndpoint="/api/super-admin/payment-gateway-config"
              successLabel="Platform PayU configuration saved"
              configFields={[
                { key: "merchant_key", label: "Merchant Key", type: "text", required: true, placeholder: "Enter PayU merchant key" },
                { key: "merchant_salt", label: "Merchant Salt", type: "password", required: true, placeholder: "Enter PayU merchant salt" },
                { key: "auth_header", label: "Auth Header (optional)", type: "password", required: false, placeholder: "Base64(key:salt) if different" },
              ]}
            />
            <div className="mt-5">
              <PaymentGatewayTestButton
                provider="payu"
                label="Validate config"
                helperText="Checks whether the saved platform PayU credentials are complete. PayU is not yet used by the org-plan runtime."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Sparkles className="size-5 text-muted-foreground" />
            <div>
              <h3 className="text-xl font-black">How it works</h3>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Razorpay</strong> is the live provider used by the org-plan checkout flow, subscription provisioning, and payment retries.
          </p>
          <p>
            <strong>PayU</strong> can be stored here for future platform-billing expansion, but it does not power organization-plan checkout yet.
          </p>
          <p>
            <strong>Member memberships</strong> continue to use gym-scoped gateway settings under the admin payment-providers screen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
