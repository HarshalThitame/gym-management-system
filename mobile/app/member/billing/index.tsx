import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { billingService } from "@/services/billing-service";
import { ArrowLeft, Download, Receipt, CreditCard, CircleDollarSign } from "lucide-react-native";
import type { Invoice, Payment } from "@/types";
import { getSupabaseClient } from "@/api/supabase";

export default function BillingScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [outstanding, setOutstanding] = useState(0);

  useEffect(() => {
    loadBilling();
  }, []);

  const loadBilling = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: member } = await supabase.from("members").select("id").eq("user_id", profile?.id ?? "").maybeSingle();
      if (member) {
        const [inv, pay] = await Promise.all([
          billingService.getInvoices(member.id),
          billingService.getPayments(member.id),
        ]);
        setInvoices(inv);
        setPayments(pay);
        setOutstanding(await billingService.getOutstandingDues(member.id));
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Payments & Billing</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <Card variant="muted" padded style={{ flex: 1 }}>
            <CircleDollarSign size={20} color={theme.colors.primary} />
            <Text variant="stat" style={{ marginTop: theme.spacing.sm }}>₹{totalPaid.toLocaleString()}</Text>
            <Text variant="caption" muted>Total Paid</Text>
          </Card>
          <Card variant="muted" padded style={{ flex: 1 }}>
            <Receipt size={20} color={outstanding > 0 ? theme.colors.warning : theme.colors.success} />
            <Text variant="stat" color={outstanding > 0 ? theme.colors.warning : theme.colors.success} style={{ marginTop: theme.spacing.sm }}>
              ₹{outstanding.toLocaleString()}
            </Text>
            <Text variant="caption" muted>Outstanding</Text>
          </Card>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Text variant="h4">Invoices</Text>
          {invoices.length === 0 ? (
            <EmptyState title="No invoices" description="Your invoices will appear here." />
          ) : (
            invoices.slice(0, 10).map((inv) => (
              <TouchableOpacity key={inv.id} activeOpacity={0.7} onPress={() => router.push(`/member/billing/invoice/${inv.id}`)}>
                <Card variant="muted">
                  <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                        <Receipt size={16} color={theme.colors.fgMuted} />
                        <Text variant="subtitle">{inv.invoice_number}</Text>
                      </View>
                      <Text variant="bodySmall" muted style={{ marginTop: 2 }}>
                        {new Date(inv.issued_at).toLocaleDateString("en-IN")} · ₹{inv.total_amount.toLocaleString()}
                      </Text>
                    </View>
                    <Badge
                      variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "warning"}
                      label={inv.status.toUpperCase()}
                      size="sm"
                    />
                  </CardContent>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Text variant="h4">Recent Payments</Text>
          {payments.length === 0 ? (
            <EmptyState title="No payments" description="Your payment history will appear here." />
          ) : (
            payments.slice(0, 10).map((pay) => (
              <Card key={pay.id} variant="muted">
                <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text variant="subtitle">{pay.payment_number}</Text>
                    <Text variant="bodySmall" muted>
                      {new Date(pay.created_at).toLocaleDateString("en-IN")} · {pay.payment_method}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text variant="subtitle">₹{pay.amount.toLocaleString()}</Text>
                    <Badge
                      variant={pay.status === "paid" ? "success" : pay.status === "failed" ? "danger" : "warning"}
                      label={pay.status.toUpperCase()}
                      size="sm"
                    />
                  </View>
                </CardContent>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
