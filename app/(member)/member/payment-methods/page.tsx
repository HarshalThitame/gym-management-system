import type { Metadata } from "next";
import { CreditCard, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { PageHeader, AnimatedCardSection } from "@/features/member/components/page-wrappers";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DeletePaymentMethodButton } from "./delete-method-button";

export const metadata: Metadata = createMetadata({
  title: "Payment Methods",
  description: "Manage your saved payment methods for auto-renewal.",
  path: "/member/payment-methods",
});

export default async function MemberPaymentMethodsPage() {
  const context = await requireMemberPortalAccess("/member/payment-methods");

  const supabase = await createSupabaseServerClient();

  const { data: methods } = await supabase
    .from("member_payment_methods")
    .select("*")
    .eq("member_id", context.userId)
    .eq("is_active", true)
    .order("is_default", { ascending: false }) as never as {
    data: Array<{
      id: string;
      provider: string;
      payment_type: string;
      display_name: string;
      last_four: string | null;
      card_network: string | null;
      expiry_month: number | null;
      expiry_year: number | null;
      is_default: boolean;
    }> | null;
    error: unknown;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Payment Methods" description="Manage your saved payment methods used for auto-renewal and online payments." />

      <AnimatedCardSection>
        <Card variant="glass">
          <CardHeader>
            <h2 className="text-2xl font-black">Saved Methods</h2>
            <p className="text-sm text-slate">Payment methods are saved securely via Razorpay. Full card details are never stored on our servers.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {!methods || methods.length === 0 ? (
              <EmptyState simple text="No saved payment methods. Enable auto-renewal to set up recurring payments." />
            ) : (
              methods.map((method) => (
                <div key={method.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <CreditCard className="size-5 text-slate" />
                    <div>
                      <p className="font-bold text-white">
                        {method.display_name}
                        {method.is_default ? <Badge variant="success" className="ml-2">Default</Badge> : null}
                      </p>
                      <p className="text-xs text-slate">
                        {method.payment_type.replace(/_/g, " ")}
                        {method.last_four ? ` · ending in ${method.last_four}` : ""}
                        {method.expiry_month && method.expiry_year ? ` · expires ${method.expiry_month}/${method.expiry_year}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={method.provider === "razorpay" ? "info" : "warning"}>
                      {method.provider}
                    </Badge>
                    <DeletePaymentMethodButton methodId={method.id} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </AnimatedCardSection>
    </div>
  );
}
