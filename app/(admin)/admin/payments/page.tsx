import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Admin Payments",
  description: "Protected admin payment management foundation.",
  path: "/admin/payments"
});

export default function AdminPaymentsPage() {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl font-black">Payments</h2>
        <p className="text-sm leading-6 text-muted-foreground">Payment operations are reserved for authorized staff and will be connected to Razorpay and offline collections.</p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No payment records connected yet.</div>
      </CardContent>
    </Card>
  );
}
