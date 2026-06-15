import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { branchService } from "@/services/branch-service";
import { ArrowLeft, MapPin, Phone, Clock } from "lucide-react-native";
import type { Branch } from "@/types";

export default function BranchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState<Branch | null>(null);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const b = await branchService.getBranchById(id);
      setBranch(b);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;
  if (!branch) return <Text>Branch not found</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">{branch.name}</Text>
        <Badge variant={branch.status === "active" ? "success" : "neutral"} label={branch.status} />
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.md }}>
            <DetailRow icon={<MapPin size={16} />} label="Address" value={`${branch.address ?? ""}, ${branch.city ?? ""}, ${branch.state ?? ""}, ${branch.country}`} />
            <DetailRow icon={<Phone size={16} />} label="Phone" value={branch.phone ?? "N/A"} />
            <DetailRow icon={<Clock size={16} />} label="Timezone" value={branch.timezone} />
            <DetailRow label="Currency" value={branch.currency} />
            <DetailRow label="Branch Code" value={branch.branch_code} />
            <DetailRow label="Capacity" value={String(branch.capacity)} />
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
      {icon && <View style={{ opacity: 0.5 }}>{icon}</View>}
      <Text variant="caption" muted style={{ width: 90 }}>{label}</Text>
      <Text variant="body" style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}
