import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { branchService } from "@/services/branch-service";
import { MapPin, Phone, Clock, ChevronRight } from "lucide-react-native";
import type { Branch } from "@/types";
import { getSupabaseClient } from "@/api/supabase";

export default function BranchesScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: member } = await supabase.from("members").select("id, organization_id").eq("user_id", profile?.id ?? "").maybeSingle();
      if (member?.organization_id) {
        const b = await branchService.getOrganizationBranches(member.organization_id);
        setBranches(b);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Branches</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        {branches.map((branch) => (
          <TouchableOpacity key={branch.id} activeOpacity={0.7}>
            <Card variant="muted">
              <CardContent style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text variant="h4">{branch.name}</Text>
                  <Badge variant={branch.status === "active" ? "success" : "neutral"} label={branch.status} size="sm" />
                </View>

                {branch.address && (
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm }}>
                    <MapPin size={16} color={theme.colors.fgMuted} style={{ marginTop: 2 }} />
                    <Text variant="bodySmall" muted style={{ flex: 1 }}>
                      {branch.address}{branch.city ? `, ${branch.city}` : ""}{branch.state ? `, ${branch.state}` : ""}
                    </Text>
                  </View>
                )}

                {branch.phone && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                    <Phone size={16} color={theme.colors.fgMuted} />
                    <Text variant="bodySmall" muted>{branch.phone}</Text>
                  </View>
                )}

                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                  <Clock size={16} color={theme.colors.fgMuted} />
                  <Text variant="bodySmall" muted>
                    {branch.timezone} · {branch.currency}
                  </Text>
                </View>
              </CardContent>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
