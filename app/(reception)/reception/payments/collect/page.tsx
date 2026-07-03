import type { Metadata } from "next";
import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { listMembers } from "@/features/memberships/services/membership-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { PaymentCollectForm } from "@/features/payments/components/payment-collect-form";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Collect Payment",
  description: "Collect cash, UPI, or card payments from members at the front desk.",
  path: "/reception/payments/collect"
});

type PaymentCollectPageProps = {
  searchParams: Promise<{ method?: string; memberId?: string }>;
};

export default async function PaymentCollectPage({ searchParams }: PaymentCollectPageProps) {
  const scope = await requireReceptionScope("/reception/payments/collect");
  const params = await searchParams;
  const method = params.method ?? "cash";
  const membersResult = await listMembers({
    gymId: scope.gymId,
    branchId: scope.branchId,
    organizationId: scope.scopedOrganizationId ?? scope.organizationId,
    pageSize: 100,
  });

  const methodLabels: Record<string, { label: string; icon: typeof Banknote }> = {
    cash: { label: "Cash Payment", icon: Banknote },
    upi: { label: "UPI / Card Payment", icon: CreditCard },
    card: { label: "Card Payment", icon: Smartphone }
  };
  const config = methodLabels[method] ?? methodLabels.cash;
  const Icon = config.icon;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Payment Collection</p>
        <h2 className="mt-2 text-3xl font-black">{config.label}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Record a {method} payment from a member. All payments are scoped to your assigned branch and generate receipts automatically.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon className="size-5 text-accent" />
              <h3 className="text-2xl font-black">Payment Details</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Fill in the payment information below. Amounts are recorded in INR.
            </p>
          </CardHeader>
          <CardContent>
            <PaymentCollectForm
              defaultMethod={method}
              members={membersResult.members}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Collection Guide</h3>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            {method === "cash" && (
              <>
                <p>1. Select the member from the dropdown.</p>
                <p>2. Enter the exact amount being collected.</p>
                <p>3. Select the payment type (membership dues, PT fees, etc.).</p>
                <p>4. Add any notes for reference.</p>
                <p>5. Click Collect to record the payment.</p>
                <p className="mt-4 font-bold text-foreground">Note: Cash payments are recorded at face value. Count and verify before submission.</p>
              </>
            )}
            {method === "upi" && (
              <>
                <p>1. Select the member who is paying.</p>
                <p>2. Enter the amount being collected.</p>
                <p>3. Select the payment type.</p>
                <p>4. For UPI, verify the transaction on the customer&apos;s phone.</p>
                <p>5. For card, swipe/dip/tap and wait for terminal confirmation.</p>
                <p className="mt-4 font-bold text-foreground">Note: Record the terminal reference or UPI transaction ID in the notes for reconciliation.</p>
              </>
            )}
            {method === "card" && (
              <>
                <p>1. Swipe, dip, or tap the member&apos;s card on the POS terminal.</p>
                <p>2. Enter the amount being charged.</p>
                <p>3. Select the payment type.</p>
                <p>4. Wait for terminal approval before recording.</p>
                <p className="mt-4 font-bold text-foreground">Note: Card payments are processed through the Razorpay POS terminal. Record the transaction ID for reconciliation.</p>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
