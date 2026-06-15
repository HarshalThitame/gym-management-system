import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft, User, Mail, Phone, Shield } from "lucide-react-native";

export default function StaffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any>(null);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("branch_users").select("*, profiles!inner(full_name, email, phone)").eq("id", id).maybeSingle();
      setStaff(data);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;
  if (!staff) return <Text>Staff not found</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Staff Detail</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ alignItems: "center", gap: theme.spacing.md, paddingVertical: theme.spacing.xl }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
              <Text variant="h1" color={theme.colors.primary}>{(staff as any).profiles?.full_name?.charAt(0) ?? "?"}</Text>
            </View>
            <Text variant="h3">{(staff as any).profiles?.full_name}</Text>
            <Badge variant={staff.status === "active" ? "success" : staff.status === "invited" ? "warning" : "neutral"} label={staff.status} />
          </CardContent>
        </Card>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.md }}>
            <DetailRow icon={<Mail size={16} />} label="Email" value={(staff as any).profiles?.email ?? "N/A"} />
            <DetailRow icon={<Phone size={16} />} label="Phone" value={(staff as any).profiles?.phone ?? "N/A"} />
            <DetailRow icon={<Shield size={16} />} label="Role" value={staff.role_name?.replace("_", " ")} />
            <DetailRow icon={<Shield size={16} />} label="Branch Role" value={staff.branch_role} />
            <DetailRow label="Access Scope" value={staff.access_scope} />
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
      <Text variant="caption" muted style={{ width: 100 }}>{label}</Text>
      <Text variant="body" style={{ flex: 1 }}>{value}</Text>
    </View>
  );
}
