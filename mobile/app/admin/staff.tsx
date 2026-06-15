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

export default function AdminStaffScreen() {
  const { theme } = useTheme();
  const { profile, organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);

  useEffect(() => { loadStaff(); }, []);

  const loadStaff = async () => {
    try {
      if (!organizationId) return;
      const s = await adminStaffService.getStaff(organizationId);
      const gymStaff = s.filter((m) => (m as any).gym_id === profile?.gym_id);
      setStaff(gymStaff);
    } catch {} finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Staff</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadStaff} tintColor={theme.colors.primary} />}>
        {staff.length === 0 ? <EmptyState icon={<Users size={48} />} title="No staff" description="Staff members will appear here." />
          : staff.map((s: any) => (
            <Card key={s.id} variant="muted">
              <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text variant="bodySmall" bold>{(s as any).profiles?.full_name ?? "Staff"}</Text>
                  <Text variant="caption" muted>{s.role_name.replace("_", " ")}</Text>
                </View>
                <Badge variant={s.status === "active" ? "success" : "neutral"} label={s.status} size="sm" />
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
