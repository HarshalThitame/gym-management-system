import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl, TextInput } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { crmLeadService, type LeadExtended } from "@/services/crm/crm-lead-service";
import { crmPipelineService, PIPELINE_STAGES } from "@/services/crm/crm-pipeline-service";
import { MessageSquare, Search, ChevronRight, Plus } from "lucide-react-native";

export default function AdminLeadsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadExtended[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      if (!profile?.gym_id) return;
      const l = await crmLeadService.getLeadsByGym(profile.gym_id);
      setLeads(l);
    } catch {} finally { setLoading(false); }
  }, [profile?.gym_id]);

  useEffect(() => { load(); }, [load]);

  const filtered = leads.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.phone.includes(q) || (l.email?.toLowerCase() ?? "").includes(q);
    }
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text variant="h2">Leads</Text>
        <TouchableOpacity onPress={() => router.push("/admin/leads/add")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Plus size={22} color={theme.colors.primaryFg} />
        </TouchableOpacity>
      </View>
      <View style={{ paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.bgSurface, borderRadius: theme.radii.md, paddingHorizontal: theme.spacing.md, height: 44, borderWidth: 1, borderColor: theme.colors.border }}>
          <Search size={18} color={theme.colors.fgMuted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search leads..." placeholderTextColor={theme.colors.fgMuted} style={{ flex: 1, marginLeft: theme.spacing.sm, color: theme.colors.fg, fontSize: 14 }} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: theme.spacing.lg, marginBottom: theme.spacing.md }}>
        {["all", ...PIPELINE_STAGES.map((s) => s.status)].map((s) => (
          <TouchableOpacity key={s} onPress={() => setStatusFilter(s)}
            style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.full, marginRight: 4, backgroundColor: statusFilter === s ? theme.colors.primary : theme.colors.bgSurfaceMuted }}>
            <Text variant="caption" color={statusFilter === s ? "#fff" : theme.colors.fg}>{s === "all" ? "All" : s.replace("_", " ")}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        {filtered.length === 0 ? <EmptyState icon={<MessageSquare size={48} />} title={search ? "No matches" : "No leads"} description={search ? "Try a different search." : "Leads will appear here."} />
          : filtered.map((lead) => {
            const stage = PIPELINE_STAGES.find((s) => s.status === lead.status);
            return (
              <TouchableOpacity key={lead.id} activeOpacity={0.7} onPress={() => router.push(`/admin/leads/${lead.id}`)}>
                <Card variant="muted">
                  <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: (stage?.color ?? "#6b7280") + "20", alignItems: "center", justifyContent: "center" }}>
                      <Text variant="subtitle" style={{ color: stage?.color ?? "#6b7280" }}>{lead.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="subtitle">{lead.name}</Text>
                      <Text variant="caption" muted>{lead.phone} · {lead.source?.replace("_", " ")}</Text>
                    </View>
                    <Badge variant={lead.status === "converted" ? "success" : lead.status === "lost" ? "danger" : "warning"} label={stage?.label ?? lead.status} size="sm" />
                    <ChevronRight size={18} color={theme.colors.fgMuted} />
                  </CardContent>
                </Card>
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </View>
  );
}
