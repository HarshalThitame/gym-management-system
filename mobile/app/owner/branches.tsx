import React, { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { adminGymService } from "@/services/admin/gym-service";
import { MapPin } from "lucide-react-native";
import type { Branch } from "@/types";

export default function OwnerBranchesScreen() {
  const { theme } = useTheme();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      if (!organizationId) return;
      const b = await adminGymService.getOrgBranches(organizationId);
      setBranches(b);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">All Branches</Text>
        <Text variant="bodySmall" muted>{branches.length} total</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        {branches.length === 0 ? <EmptyState icon={<MapPin size={48} />} title="No branches" description="Branches will appear here once created." />
          : branches.map((b) => (
            <Card key={b.id} variant="muted">
              <CardContent style={{ gap: theme.spacing.xs }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text variant="subtitle">{b.name}</Text>
                  <Badge variant={b.status === "active" ? "success" : "neutral"} label={b.status} size="sm" />
                </View>
                <Text variant="caption" muted>{b.branch_code} · {b.city}{b.state ? `, ${b.state}` : ""}</Text>
                {b.phone && <Text variant="caption" muted>{b.phone}</Text>}
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
