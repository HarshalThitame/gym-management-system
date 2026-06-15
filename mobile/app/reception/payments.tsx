import React, { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl, Alert } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { getSupabaseClient } from "@/api/supabase";
import { CreditCard, CircleDollarSign } from "lucide-react-native";

export default function ReceptionPaymentsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => { loadPayments(); }, []);

  const loadPayments = async () => {
    try {
      if (!profile?.gym_id) return;
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split("T")[0];

      const [paid, pending, all] = await Promise.all([
        supabase.from("payments").select("amount").eq("gym_id", profile.gym_id).eq("status", "paid").gte("created_at", today),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).in("status", ["pending", "processing", "failed"]),
        supabase.from("payments").select("payment_number, amount, status, payment_method, paid_at, members(full_name)").eq("gym_id", profile.gym_id).order("created_at", { ascending: false }).limit(20),
      ]);

      setTodayTotal((paid.data ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0));
      setPendingCount(pending.count ?? 0);
      setPayments(all.data ?? []);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Payment Collection</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPayments} tintColor={theme.colors.primary} />}>
        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}><AdminKpiCard label="Collected Today" value={`₹${todayTotal.toLocaleString()}`} icon={<CircleDollarSign size={20} />} /></View>
          <View style={{ flex: 1 }}><AdminKpiCard label="Pending" value={pendingCount} icon={<CreditCard size={20} />} /></View>
        </View>

        <Button variant="primary" fullWidth onPress={() => Alert.alert("New Payment", "Payment collection form coming soon.")}>
          <CircleDollarSign size={18} color={theme.colors.primaryFg} /> Collect Payment
        </Button>

        <Text variant="h4">Recent Transactions</Text>
        {payments.length === 0 ? <EmptyState title="No transactions" description="Payments collected today will appear here." />
          : payments.map((p: any, i: number) => (
            <Card key={i} variant="muted">
              <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text variant="bodySmall" bold>{(p as any).members?.full_name ?? "Walk-in"}</Text>
                  <Text variant="caption" muted>{p.payment_number} · {p.payment_method}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text variant="bodySmall">₹{p.amount.toLocaleString()}</Text>
                  <Badge variant={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "warning"} label={p.status} size="sm" />
                </View>
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
