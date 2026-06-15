import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { adminGymService } from "@/services/admin/gym-service";
import { Building2, ChevronRight, MapPin, Users, Dumbbell } from "lucide-react-native";
import type { Gym } from "@/types";

export default function OwnerGymsScreen() {
  const { theme } = useTheme();
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [gyms, setGyms] = useState<(Gym & { branchCount?: number; memberCount?: number })[]>([]);

  useEffect(() => { loadGyms(); }, []);

  const loadGyms = async () => {
    try {
      if (!organizationId) return;
      const g = await adminGymService.getGyms(organizationId);
      const enriched = await Promise.all(g.map(async (gym) => {
        const [branches, members] = await Promise.all([
          adminGymService.getBranches(gym.id),
          adminGymService.getGymMembers(gym.id, 1),
        ]);
        return { ...gym, branchCount: branches.length, memberCount: 0 };
      }));
      setGyms(enriched);
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Gyms & Branches</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadGyms} tintColor={theme.colors.primary} />}>
        {gyms.length === 0 ? <EmptyState title="No gyms" description="Create your first gym to get started." />
          : gyms.map((gym) => (
            <TouchableOpacity key={gym.id} activeOpacity={0.7} onPress={() => router.push(`/owner/gyms/${gym.id}`)}>
              <Card variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                    <Building2 size={24} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="subtitle">{gym.name}</Text>
                    <View style={{ flexDirection: "row", gap: theme.spacing.md, marginTop: 4 }}>
                      <Text variant="caption" muted>{gym.branchCount ?? 0} branches</Text>
                      <Text variant="caption" muted>{gym.memberCount ?? 0} members</Text>
                    </View>
                  </View>
                  <Badge variant={gym.status === "active" ? "success" : "neutral"} label={gym.status} size="sm" />
                  <ChevronRight size={18} color={theme.colors.fgMuted} />
                </CardContent>
              </Card>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );
}
