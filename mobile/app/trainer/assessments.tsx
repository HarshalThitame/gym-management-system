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
import { getSupabaseClient } from "@/api/supabase";
import { ClipboardList, ChevronRight, Activity } from "lucide-react-native";

export default function AssessmentsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: trainer } = await supabase.from("trainers").select("id").eq("gym_id", profile?.gym_id ?? "").maybeSingle();
      if (!trainer) return;
      const { data } = await supabase.from("trainer_assignments").select("member_id, members!inner(id, full_name, member_code)").eq("trainer_id", trainer.id).eq("status", "active");
      setMembers((data ?? []).map((a: any) => a.members));
    } catch {} finally { setLoading(false); }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Fitness Assessments</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        {members.length === 0 ? <EmptyState icon={<ClipboardList size={48} />} title="No members" description="Member fitness assessments will appear here." />
          : members.map((m: any) => (
            <TouchableOpacity key={m.id} activeOpacity={0.7}>
              <Card variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <Activity size={20} color={theme.colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="subtitle">{m.full_name}</Text>
                    <Text variant="caption" muted>{m.member_code}</Text>
                  </View>
                  <ChevronRight size={18} color={theme.colors.fgMuted} />
                </CardContent>
              </Card>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );
}
