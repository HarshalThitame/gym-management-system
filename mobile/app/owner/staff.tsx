import React, { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { adminStaffService } from "@/services/admin/staff-service";
import { Users } from "lucide-react-native";
import type { BranchUser } from "@/types";

export default function OwnerStaffScreen() {
  const { theme } = useTheme();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<BranchUser[]>([]);

  useEffect(() => { loadStaff(); }, []);

  const loadStaff = async () => {
    try {
      if (!organizationId) return;
      const s = await adminStaffService.getStaff(organizationId);
      setStaff(s);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  const grouped = staff.reduce<Record<string, BranchUser[]>>((acc, s) => {
    const role = s.role_name.replace("_", " ");
    if (!acc[role]) acc[role] = [];
    acc[role].push(s);
    return acc;
  }, {});

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Staff Management</Text>
        <Text variant="bodySmall" muted>{staff.length} total staff</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadStaff} tintColor={theme.colors.primary} />}>
        {staff.length === 0 ? <EmptyState icon={<Users size={48} />} title="No staff" description="Staff members will appear here once added." />
          : Object.entries(grouped).map(([role, members]) => (
            <View key={role} style={{ gap: theme.spacing.sm }}>
              <Text variant="caption" muted uppercase>{role} ({members.length})</Text>
              {members.map((m) => (
                <Card key={m.id} variant="muted">
                  <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View>
                      <Text variant="subtitle">{(m as any).profiles?.full_name ?? "Staff"}</Text>
                      <Text variant="caption" muted>{(m as any).profiles?.email ?? ""}</Text>
                    </View>
                    <Badge variant={m.status === "active" ? "success" : m.status === "invited" ? "warning" : "neutral"} label={m.status} size="sm" />
                  </CardContent>
                </Card>
              ))}
            </View>
          ))}
      </ScrollView>
    </View>
  );
}
