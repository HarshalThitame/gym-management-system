import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { adminOrganizationService } from "@/services/admin/organization-service";
import { ArrowLeft, Palette, Globe, Image } from "lucide-react-native";

export default function BrandingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      if (!organizationId) return;
      const tc = await adminOrganizationService.getTenantConfig(organizationId);
      setConfig(tc);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Branding & White Label</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
              <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: config?.primary_color ?? theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
                <Text variant="h2" style={{ color: "#fff" }}>{config?.brand_name?.charAt(0) ?? "A"}</Text>
              </View>
              <View>
                <Text variant="h3">{config?.brand_name ?? "Your Brand"}</Text>
                <Text variant="caption" muted>Tenant: {config?.tenant_key ?? "N/A"}</Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: theme.colors.border }} />

            <BrandRow icon={<Palette size={16} />} label="Primary Color" value={config?.primary_color ?? "#FF6B35"} />
            <BrandRow icon={<Palette size={16} />} label="Secondary Color" value={config?.secondary_color ?? "#222429"} />
            <BrandRow icon={<Palette size={16} />} label="Accent Color" value={config?.accent_color ?? "#ffffff"} />
            <BrandRow icon={<Globe size={16} />} label="Custom Domain" value={config?.custom_domain ?? "Not configured"} />
            <BrandRow icon={<Image size={16} />} label="Logo" value={config?.logo_url ? "Uploaded" : "Not uploaded"} />
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}

function BrandRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
      {icon}
      <Text variant="body" muted style={{ flex: 1 }}>{label}</Text>
      <Text variant="caption" bold>{value}</Text>
    </View>
  );
}
