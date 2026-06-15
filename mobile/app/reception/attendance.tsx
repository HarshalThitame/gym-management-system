import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl, TextInput, Alert } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { useHaptics } from "@/hooks/use-haptics";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { attendanceService } from "@/services/attendance-service";
import { attendanceRules } from "@/services/attendance-rules";
import { getSupabaseClient } from "@/api/supabase";
import { Search, CalendarCheck, Clock, CheckCircle2, Shield, UserCheck } from "lucide-react-native";

export default function ReceptionAttendanceScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { success: hapticSuccess, error: hapticError } = useHaptics();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [validationMessage, setValidationMessage] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => { loadToday(); }, []);

  const loadToday = async () => {
    try {
      if (!profile?.gym_id) return;
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split("T")[0];
      const [count, recent] = await Promise.all([
        supabase.from("attendance_sessions").select("id", { count: "exact", head: true }).eq("gym_id", profile.gym_id).gte("check_in_at", today),
        supabase.from("attendance_sessions").select("check_in_at, status, method, members(full_name, member_code, id)")
          .eq("gym_id", profile.gym_id).order("check_in_at", { ascending: false }).limit(20),
      ]);
      setTodayCount(count.count ?? 0);
      setRecentCheckins(recent.data ?? []);
    } catch {} finally { setLoading(false); }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !profile?.gym_id) return;
    setSearching(true);
    setValidationMessage(null);
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("members").select("id, full_name, member_code, phone, status")
        .eq("gym_id", profile.gym_id)
        .or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,member_code.ilike.%${searchQuery}%`)
        .limit(10);
      setSearchResults(data ?? []);
    } catch {} finally { setSearching(false); }
  };

  const handleQuickCheckin = async (memberId: string) => {
    if (!profile?.gym_id) return;
    setValidationMessage(null);

    const validation = await attendanceRules.validateCheckIn(memberId, profile.gym_id);
    if (!validation.ok) {
      setValidationMessage({ ok: false, message: validation.error ?? "Check-in not allowed" });
      hapticError();
      return;
    }

    const result = await attendanceService.checkIn(memberId, profile.gym_id, "manual");
    if (result.ok) {
      hapticSuccess();
      setValidationMessage({ ok: true, message: "Check-in successful!" });
      loadToday();
      setSearchResults([]);
      setSearchQuery("");
      setTimeout(() => setValidationMessage(null), 3000);
    } else {
      setValidationMessage({ ok: false, message: result.error ?? "Check-in failed" });
      hapticError();
    }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Check-In Desk</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadToday} tintColor={theme.colors.primary} />}>
        <AdminKpiCard label="Today's Check-Ins" value={todayCount} icon={<CalendarCheck size={20} />} />

        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.bgSurface, borderRadius: theme.radii.md, paddingHorizontal: theme.spacing.md, height: 44, borderWidth: 1, borderColor: theme.colors.border }}>
          <Search size={18} color={theme.colors.fgMuted} />
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search member name, code or phone..."
            placeholderTextColor={theme.colors.fgMuted} onSubmitEditing={handleSearch} returnKeyType="search"
            style={{ flex: 1, marginLeft: theme.spacing.sm, color: theme.colors.fg, fontSize: 14 }} />
        </View>

        {validationMessage && (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: theme.spacing.sm,
            padding: theme.spacing.md, borderRadius: theme.radii.md,
            backgroundColor: validationMessage.ok ? theme.colors.successMuted : theme.colors.dangerMuted,
          }}>
            {validationMessage.ok ? <CheckCircle2 size={20} color={theme.colors.success} /> : <Shield size={20} color={theme.colors.danger} />}
            <Text variant="body" color={validationMessage.ok ? theme.colors.success : theme.colors.danger}>{validationMessage.message}</Text>
          </View>
        )}

        {searchResults.length > 0 && (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="caption" muted uppercase>Search Results ({searchResults.length})</Text>
            {searchResults.map((m) => (
              <Card key={m.id} variant="muted">
                <CardContent style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text variant="subtitle">{m.full_name}</Text>
                    <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: 2 }}>
                      <Text variant="caption" muted>{m.member_code}</Text>
                      <Text variant="caption" muted>{m.phone}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => handleQuickCheckin(m.id)}
                    style={{ padding: theme.spacing.sm, backgroundColor: m.status === "active" ? theme.colors.successMuted : theme.colors.dangerMuted, borderRadius: theme.radii.md }}>
                    <UserCheck size={20} color={m.status === "active" ? theme.colors.success : theme.colors.danger} />
                  </TouchableOpacity>
                </CardContent>
              </Card>
            ))}
          </View>
        )}

        <Text variant="h4">Recent Check-Ins</Text>
        {recentCheckins.length === 0 ? <EmptyState title="No check-ins today" description="Member check-ins will appear here." />
          : recentCheckins.map((c: any, i: number) => (
            <Card key={c.id ?? i} variant="muted">
              <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <Clock size={16} color={theme.colors.fgMuted} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall" bold>{c.members?.full_name ?? "Member"}</Text>
                  <Text variant="caption" muted>{c.members?.member_code ?? ""}</Text>
                </View>
                <Text variant="caption" muted>{new Date(c.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Text>
                <Badge variant={c.status === "active" ? "success" : "neutral"} label={c.method.toUpperCase()} size="sm" />
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
