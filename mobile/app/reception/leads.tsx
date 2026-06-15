import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl, TextInput, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminKpiCard } from "@/components/admin/AdminKpiCard";
import { crmLeadService } from "@/services/crm/crm-lead-service";
import { crmPipelineService, PIPELINE_STAGES } from "@/services/crm/crm-pipeline-service";
import { crmAnalyticsService } from "@/services/crm/crm-analytics-service";
import { MessageSquare, Plus, Search, Phone, ChevronRight, Filter } from "lucide-react-native";
import type { LeadExtended, LeadStatus } from "@/services/crm/crm-lead-service";

const STATUS_FILTERS: (LeadStatus | "all")[] = ["all", "new", "contacted", "interested", "trial_scheduled", "negotiation", "converted", "lost"];

export default function ReceptionLeadsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadExtended[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [stats, setStats] = useState({ new: 0, total: 0 });

  const load = useCallback(async () => {
    try {
      if (!profile?.gym_id) return;
      const l = await crmLeadService.getLeadsByGym(profile.gym_id);
      setLeads(l);
      const a = await crmAnalyticsService.getGymCRMAnalytics(profile.gym_id);
      setStats({ new: a.newLeads, total: a.totalLeads });
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
        <TouchableOpacity onPress={() => router.push("/reception/leads/add")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Plus size={22} color={theme.colors.primaryFg} />
        </TouchableOpacity>
      </View>
      <View style={{ paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.bgSurface, borderRadius: theme.radii.md, paddingHorizontal: theme.spacing.md, height: 44, borderWidth: 1, borderColor: theme.colors.border }}>
          <Search size={18} color={theme.colors.fgMuted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search name, phone, email..." placeholderTextColor={theme.colors.fgMuted} style={{ flex: 1, marginLeft: theme.spacing.sm, color: theme.colors.fg, fontSize: 14 }} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: theme.spacing.lg, marginBottom: theme.spacing.md }}>
        <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
          {STATUS_FILTERS.map((s) => {
            const stage = s === "all" ? null : PIPELINE_STAGES.find((ps) => ps.status === s);
            return (
              <TouchableOpacity key={s} onPress={() => setStatusFilter(s)}
                style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.full, backgroundColor: statusFilter === s ? (stage?.color ?? theme.colors.primary) : theme.colors.bgSurfaceMuted }}>
                <Text variant="caption" color={statusFilter === s ? "#fff" : theme.colors.fg}>{s === "all" ? "All" : stage?.label ?? s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.primary} />}>
        {filtered.length === 0 ? <EmptyState icon={<MessageSquare size={48} />} title={search ? "No matches" : "No leads"} description={search ? "Try a different search." : "Add your first lead."} action={{ label: "Add Lead", onPress: () => router.push("/reception/leads/add") }} />
          : filtered.map((lead) => {
            const stage = PIPELINE_STAGES.find((s) => s.status === lead.status);
            return (
              <TouchableOpacity key={lead.id} activeOpacity={0.7} onPress={() => router.push(`/reception/leads/${lead.id}`)}>
                <Card variant="muted">
                  <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: (stage?.color ?? "#6b7280") + "20", alignItems: "center", justifyContent: "center" }}>
                      <Text variant="subtitle" style={{ color: stage?.color ?? "#6b7280" }}>{lead.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
                        <Text variant="subtitle">{lead.name}</Text>
                        {lead.priority === "high" || lead.priority === "urgent" ? (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.danger }} />
                        ) : null}
                      </View>
                      <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: 2 }}>
                        <Text variant="caption" muted>{lead.phone}</Text>
                        {lead.source && <Text variant="caption" muted>{lead.source.replace("_", " ")}</Text>}
                      </View>
                    </View>
                    <Badge variant={lead.status === "converted" ? "success" : lead.status === "lost" ? "danger" : lead.status === "new" ? "info" : "warning"} label={stage?.label ?? lead.status} size="sm" />
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
