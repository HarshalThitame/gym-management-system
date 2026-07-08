import type { Metadata } from "next";
import { CreditCard, Settings, Shield } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";
import { ProviderConfigForm } from "@/features/billing/components/provider-config-form";
import { listGymProviders } from "@/features/billing/providers/provider-config-service";

export const metadata: Metadata = createMetadata({
  title: "Payment Gateway Configuration",
  description: "Configure Razorpay and PayU payment gateways for your gym.",
  path: "/admin/payment-providers",
});

export default async function AdminPaymentProvidersPage() {
  const scope = await requireGymAdminScope("/admin/payment-providers");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");

  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "razorpay_payu_integration",
    actionName: "admin.payment-providers.read",
  });

  const result = await listGymProviders(scope.gymId);
  const existingProviders = result.ok ? result.providers : [];

  const razorpayConfig = existingProviders.find((p) => p.provider === "razorpay");
  const payuConfig = existingProviders.find((p) => p.provider === "payu");

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Billing Configuration</p>
        <h2 className="mt-2 text-3xl font-black">Payment Gateways</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Configure Razorpay and PayU payment gateways. Keys and secrets are encrypted at rest in the database. 
          The default provider is used for checkout and auto-billing flows.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100">
                <Shield className="size-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-xl font-black">PayU</h3>
                <p className="text-sm text-muted-foreground">
                  {payuConfig?.isActive ? "Active" : "Not configured"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ProviderConfigForm
              provider="payu"
              initialConfig={payuConfig?.config ?? {}}
              isActive={payuConfig?.isActive ?? false}
              isDefault={payuConfig?.isDefault ?? false}
              priority={payuConfig?.priority ?? 2}
              testMode={payuConfig?.testMode ?? true}
              configFields={[
                { key: "merchant_key", label: "Merchant Key", type: "text", required: true, placeholder: "Enter PayU merchant key" },
                { key: "merchant_salt", label: "Merchant Salt", type: "password", required: true, placeholder: "Enter PayU merchant salt" },
                { key: "auth_header", label: "Auth Header (optional)", type: "password", required: false, placeholder: "Base64(key:salt) if different" },
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
            <strong>PayU</strong> supports orders, refunds, and webhooks. PayU does not support server-generated payment links 
            (use Razorpay for that). PayU is a good secondary gateway for regional customers.
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
