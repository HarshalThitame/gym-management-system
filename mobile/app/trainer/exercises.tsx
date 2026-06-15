import React, { useEffect, useState } from "react";
import { View, ScrollView, TextInput, RefreshControl } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSupabaseClient } from "@/api/supabase";
import { Search, Dumbbell } from "lucide-react-native";

export default function ExerciseLibraryScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("exercises").select("*").order("name").limit(100);
      setExercises(data ?? []);
    } catch {} finally { setLoading(false); }
  };

  const filtered = exercises.filter((e: any) => e.name?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Exercise Library</Text>
      </View>
      <View style={{ paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.bgSurface, borderRadius: theme.radii.md, paddingHorizontal: theme.spacing.md, height: 44, borderWidth: 1, borderColor: theme.colors.border }}>
          <Search size={18} color={theme.colors.fgMuted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search exercises..." placeholderTextColor={theme.colors.fgMuted} style={{ flex: 1, marginLeft: theme.spacing.sm, color: theme.colors.fg, fontSize: 14 }} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 100 }}>
        {filtered.length === 0 ? <EmptyState icon={<Dumbbell size={48} />} title={search ? "No matches" : "No exercises"} description={search ? "Try a different search." : "The exercise library is empty."} />
          : filtered.map((ex: any) => (
            <Card key={ex.id} variant="muted">
              <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                  <Dumbbell size={22} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="subtitle">{ex.name}</Text>
                  {ex.muscle_group && <Text variant="caption" muted>{ex.muscle_group}</Text>}
                </View>
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
