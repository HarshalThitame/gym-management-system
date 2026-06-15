import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { getSupabaseClient } from "@/api/supabase";
import { membershipService } from "@/services/membership-service";
import { ArrowLeft, Clock, Snowflake, TrendingUp, History } from "lucide-react-native";
import type { Membership, MembershipPlan } from "@/types";

export default function MembershipScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [plan, setPlan] = useState<MembershipPlan | null>(null);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [canRenew, setCanRenew] = useState(false);
  const [canUpgrade, setCanUpgrade] = useState(false);
  const [freezeEligible, setFreezeEligible] = useState<{ eligible: boolean; reason?: string }>({ eligible: false });

  useEffect(() => {
    loadMembership();
  }, []);

  const loadMembership = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: member } = await supabase.from("members").select("id").eq("user_id", profile?.id ?? "").maybeSingle();
      if (!member) return;

      const result = await membershipService.getCurrentMembership(member.id);
      setMembership(result.membership);
      setPlan(result.plan);

      if (result.membership) {
        const days = await membershipService.getRemainingDays(result.membership.end_date);
        setDaysRemaining(days);
        setCanRenew(await membershipService.canRenew(result.membership));
        setCanUpgrade(await membershipService.canUpgrade(result.membership));
        setFreezeEligible(await membershipService.checkFreezeEligibility(result.membership));
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  const badgeVariant = membership?.status === "active" ? "success"
    : membership?.status === "expired" ? "danger"
    : membership?.status === "frozen" ? "warning" : "neutral";

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.fg} />
          </TouchableOpacity>
          <Text variant="h2">Membership</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        {!membership ? (
          <Card>
            <CardContent>
              <View style={{ alignItems: "center", paddingVertical: theme.spacing.xl, gap: theme.spacing.md }}>
                <Text variant="h4" center>No Active Membership</Text>
                <Text variant="body" muted center>Contact the front desk to purchase a membership plan.</Text>
              </View>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card variant="muted">
              <CardContent style={{ gap: theme.spacing.lg }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text variant="h3">{plan?.name ?? "Membership"}</Text>
                  <Badge variant={badgeVariant} label={membership.status.toUpperCase()} dot />
                </View>

                <View style={{ flexDirection: "row", gap: theme.spacing.xl }}>
                  <InfoBlock label="Days Left" value={String(daysRemaining)} />
                  <InfoBlock label="Plan Type" value={plan?.plan_type?.replace("_", " ") ?? "N/A"} />
                </View>

                <View style={{ flexDirection: "row", gap: theme.spacing.xl }}>
                  <InfoBlock label="Start Date" value={new Date(membership.start_date).toLocaleDateString("en-IN")} />
                  <InfoBlock label="Expiry Date" value={new Date(membership.end_date).toLocaleDateString("en-IN")} />
                </View>

                {membership.total_amount > 0 && (
                  <InfoBlock label="Amount" value={`₹${membership.total_amount.toLocaleString()}`} />
                )}
              </CardContent>
            </Card>

            <View style={{ gap: theme.spacing.md }}>
              <Text variant="h4">Actions</Text>
              <View style={{ gap: theme.spacing.sm }}>
                <ActionRow
                  icon={<Clock size={20} />}
                  label="Renew Membership"
                  description={canRenew ? "Eligible for renewal" : "Renewal available within 30 days of expiry"}
                  disabled={!canRenew}
                  onPress={() => {}}
                />
                <ActionRow
                  icon={<TrendingUp size={20} />}
                  label="Upgrade Plan"
                  description={canUpgrade ? "Upgrade to a higher tier" : "Available with 15+ days remaining"}
                  disabled={!canUpgrade}
                  onPress={() => {}}
                />
                <ActionRow
                  icon={<Snowflake size={20} />}
                  label="Freeze Membership"
                  description={freezeEligible.eligible ? "Pause your membership temporarily" : freezeEligible.reason ?? "Not eligible"}
                  disabled={!freezeEligible.eligible}
                  onPress={() => {
                    if (!membership) return;
                    Alert.alert(
                      "Freeze Membership",
                      "Freeze your membership for 14 days? Your membership will be paused and the expiry date extended.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Freeze 14 Days",
                          onPress: async () => {
                            const result = await membershipService.freezeMembership(membership.id, "Member requested 14-day freeze", 14);
                            if (result.ok) {
                              Alert.alert("Frozen", "Your membership has been frozen for 14 days.", [
                                { text: "OK", onPress: () => loadMembership() },
                              ]);
                            } else {
                              Alert.alert("Error", result.error ?? "Freeze failed. Contact the front desk.");
                            }
                          },
                        },
                      ]
                    );
                  }}
                />
                <ActionRow
                  icon={<History size={20} />}
                  label="Membership History"
                  description="View your past memberships"
                  onPress={() => router.push("/member/membership/history")}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InfoBlock({ label, value, color }: { label: string; value: string; color?: string }) {
  const { theme } = useTheme();
  return (
    <View>
      <Text variant="caption" muted uppercase>{label}</Text>
      <Text variant="body" bold style={{ color, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function ActionRow({ icon, label, description, disabled, onPress }: { icon: React.ReactNode; label: string; description: string; disabled?: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={{
        flexDirection: "row", alignItems: "center", gap: theme.spacing.md,
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.bgSurface,
        borderRadius: theme.radii.lg,
        borderWidth: 1, borderColor: theme.colors.border,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="subtitle">{label}</Text>
        <Text variant="bodySmall" muted>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}


