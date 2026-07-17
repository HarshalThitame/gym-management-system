import type { Metadata } from "next";
import { Activity, CreditCard, RefreshCw, Settings, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";
import { ProviderConfigForm } from "@/features/billing/components/provider-config-form";
import { listGymProviders } from "@/features/billing/providers/provider-config-service";

export const metadata: Metadata = createMetadata({
  title: "Payment Gateway Configuration",
  description: "Configure the Razorpay payment gateway for your gym.",
  path: "/admin/payment-providers",
});

export default async function AdminPaymentProvidersPage() {
  const scope = await requireGymAdminScope("/admin/payment-providers");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");

  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "razorpay_integration",
    actionName: "admin.payment-providers.read",
  });

  const result = await listGymProviders(scope.gymId);
  const existingProviders = result.ok ? result.providers : [];

  const razorpayConfig = existingProviders.find((p) => p.provider === "razorpay");
  const activeProviders = existingProviders.filter((p) => p.isActive);
  const defaultProvider = existingProviders.find((p) => p.isDefault)?.provider ?? "none";
  const liveProviders = existingProviders.filter((p) => !p.testMode).length;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Badge variant="member-info" className="w-fit gap-1.5 border-white/20 text-white">
              <Sparkles className="size-3.5" />
              Enterprise billing controls
            </Badge>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Billing Configuration</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Payment Gateways</h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/72">
                Configure per-gym payment gateways for memberships, refunds, and checkout flows. Credentials are encrypted at rest and routed through the gym-aware payment provider layer.
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
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Runtime</p>
              <p className="mt-1 text-lg font-black">Gym-aware checkout</p>
              <p className="text-sm text-muted-foreground">Each gym can route to its own provider credentials.</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="border-border/70">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <Activity className="size-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">State</p>
              <p className="mt-1 text-lg font-black">Live status visible</p>
              <p className="text-sm text-muted-foreground">Admins can see active, default, and test/live modes quickly.</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="border-border/70">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
              <RefreshCw className="size-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Operations</p>
              <p className="mt-1 text-lg font-black">Reconfigurable</p>
              <p className="text-sm text-muted-foreground">Save, validate, and switch providers without code changes.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-1">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100">
                <CreditCard className="size-5 text-blue-700" />
              </div>
              <div>
                <h3 className="text-xl font-black">Razorpay</h3>
                <p className="text-sm text-muted-foreground">
                  {razorpayConfig?.isActive ? "Active" : "Not configured"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ProviderConfigForm
              provider="razorpay"
              initialConfig={razorpayConfig?.config ?? {}}
              isActive={razorpayConfig?.isActive ?? false}
              isDefault={razorpayConfig?.isDefault ?? false}
              priority={razorpayConfig?.priority ?? 1}
              testMode={razorpayConfig?.testMode ?? true}
              configFields={[
                { key: "key_id", label: "Key ID", type: "text", required: true, placeholder: "rzp_live_..." },
                { key: "key_secret", label: "Key Secret", type: "password", required: true, placeholder: "Enter secret key" },
                { key: "webhook_secret", label: "Webhook Secret", type: "password", required: true, placeholder: "Enter webhook secret" },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Settings className="size-5 text-muted-foreground" />
            <div>
              <h3 className="text-xl font-black">How it works</h3>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Razorpay</strong> supports orders, payment links, refunds, webhooks, reconciliation, subscriptions, and saved cards.
            It is the primary recommended gateway for auto-billing and payment links.
          </p>
          <p>
            <strong>Default provider</strong> is used for checkout flows. Set the provider with <em>priority=0</em> and 
            <em>is_default=true</em> to make it the default. Configured keys apply per-gym.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
