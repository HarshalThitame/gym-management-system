import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, Share } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { referralService } from "@/services/referral-service";
import { Gift, Share2, Users, Trophy, Copy } from "lucide-react-native";
import { getSupabaseClient } from "@/api/supabase";

export default function ReferralsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalReferrals: 0, successfulReferrals: 0, pendingReferrals: 0, totalRewards: 0, history: [] as any[] });

  useEffect(() => {
    loadReferrals();
  }, []);

  const loadReferrals = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: member } = await supabase.from("members").select("id").eq("user_id", profile?.id ?? "").maybeSingle();
      if (member) {
        let c = await referralService.getReferralCode(member.id);
        if (!c) {
          c = await referralService.generateReferralCode(member.id);
        }
        setCode(c);
        const s = await referralService.getReferralStats(member.id);
        setStats(s);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (code) {
      try {
        await Share.share({
          message: `Join me at Apex Performance Club! Use my referral code: ${code}\n\nDownload the app and start your fitness journey today.`,
        });
      } catch {}
    }
  };

  const handleCopyCode = () => {
    if (code) {
      Alert.alert("Copied", `Referral code ${code} copied to clipboard.`);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Refer a Friend</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ alignItems: "center", gap: theme.spacing.lg, paddingVertical: theme.spacing.lg }}>
            <Gift size={48} color={theme.colors.primary} />
            <Text variant="h3" center>Invite Friends & Earn Rewards</Text>
            <Text variant="body" muted center>
              Share your unique code with friends. When they join, you both get rewarded!
            </Text>

            {code && (
              <TouchableOpacity
                onPress={handleCopyCode}
                style={{
                  backgroundColor: theme.colors.bgSurface,
                  borderRadius: theme.radii.lg,
                  paddingHorizontal: theme.spacing["2xl"],
                  paddingVertical: theme.spacing.lg,
                  borderWidth: 2,
                  borderColor: theme.colors.primary,
                  borderStyle: "dashed",
                }}
              >
                <Text variant="h2" color={theme.colors.primary} style={{ letterSpacing: 2 }}>{code}</Text>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
              <Button variant="primary" onPress={handleShare}>
                <Share2 size={18} color={theme.colors.primaryFg} /> Share
              </Button>
              <Button variant="secondary" onPress={handleCopyCode}>
                <Copy size={18} /> Copy Code
              </Button>
            </View>
          </CardContent>
        </Card>

        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <Card variant="muted" padded style={{ flex: 1 }}>
            <Users size={20} color={theme.colors.primary} />
            <Text variant="stat" style={{ marginTop: 4 }}>{stats.totalReferrals}</Text>
            <Text variant="caption" muted>Total Referrals</Text>
          </Card>
          <Card variant="muted" padded style={{ flex: 1 }}>
            <Trophy size={20} color={theme.colors.warning} />
            <Text variant="stat" style={{ marginTop: 4 }}>₹{stats.totalRewards}</Text>
            <Text variant="caption" muted>Rewards Earned</Text>
          </Card>
        </View>

        {stats.history.length > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="h4">Referral History</Text>
            {stats.history.map((r, i) => (
              <Card key={i} variant="muted">
                <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text variant="bodySmall">
                      {new Date(r.created_at).toLocaleDateString("en-IN")}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                    {r.reward_amount > 0 && <Text variant="bodySmall">₹{r.reward_amount}</Text>}
                    <Badge variant={r.status === "completed" ? "success" : r.status === "pending" ? "warning" : "neutral"} label={r.status} size="sm" />
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
