import React, { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { adminReportService } from "@/services/admin/report-service";
import { getSupabaseClient } from "@/api/supabase";
import { CreditCard, TrendingUp, CircleDollarSign } from "lucide-react-native";
import type { Payment } from "@/types";

export default function AdminPaymentsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState({ monthly: 0, today: 0, pending: 0, total: 0 });
  const [recentPayments, setRecentPayments] = useState<(Payment & { members?: { full_name: string } })[]>([]);

  useEffect(() => { loadPayments(); }, []);

  const loadPayments = async () => {
    try {
      if (!profile?.gym_id) return;
      const r = await adminReportService.getRevenueReport(profile.gym_id);
      setRevenue({ monthly: r.monthly, today: r.daily[r.daily.length - 1] ?? 0, pending: 0, total: r.monthly });

      const supabase = getSupabaseClient();
      const { data } = await supabase.from("payments").select("payment_number, amount, status, paid_at, members(full_name)").eq("gym_id", profile.gym_id).order("created_at", { ascending: false }).limit(20);
        setRecentPayments(((data ?? []) as any[]) as (Payment & { members?: { full_name: string } })[]);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Payments</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPayments} tintColor={theme.colors.primary} />}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
          <View style={{ width: "47%" }}><AdminKpiCard label="Revenue (MTD)" value={`₹${revenue.monthly.toLocaleString()}`} icon={<CreditCard size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Today" value={`₹${revenue.today.toLocaleString()}`} icon={<CircleDollarSign size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Pending" value={revenue.pending} icon={<TrendingUp size={20} />} /></View>
          <View style={{ width: "47%" }}><AdminKpiCard label="Total (MTD)" value={`₹${revenue.total.toLocaleString()}`} icon={<CreditCard size={20} />} /></View>
        </View>

        <Text variant="h4">Recent Payments</Text>
        {recentPayments.length === 0 ? <EmptyState title="No payments yet" description="Payments will appear here as members transact." />
          : recentPayments.map((p, i: number) => (
            <Card key={i} variant="muted">
              <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text variant="bodySmall" bold>{p.payment_number}</Text>
                  <Text variant="caption" muted>{p.members?.full_name ?? "Member"}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text variant="bodySmall">₹{p.amount.toLocaleString()}</Text>
                  <Badge variant={p.status === "paid" ? "success" : "warning"} label={p.status} size="sm" />
                </View>
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
