import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { crmLeadService } from "@/services/crm/crm-lead-service";
import { crmPipelineService, PIPELINE_STAGES } from "@/services/crm/crm-pipeline-service";
import { ArrowLeft, Phone, Calendar, TrendingUp } from "lucide-react-native";
import type { LeadStatus } from "@/services/crm/crm-lead-service";

export default function AdminLeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<any>(null);

  useEffect(() => { load(); }, [id]);
  const load = async () => { try { const l = await crmLeadService.getLead(id); setLead(l); } catch {} finally { setLoading(false); } };

  const handleTransition = async (status: LeadStatus) => {
    const r = await crmPipelineService.transitionLead(id, status);
    if (r.ok) load(); else Alert.alert("Error", r.error ?? "Failed");
  };

  if (loading) return <LoadingState fullScreen />;
  if (!lead) return <Text>Lead not found</Text>;

  const stage = PIPELINE_STAGES.find((s) => s.status === lead.status);
  const transitions = PIPELINE_STAGES.filter((s) => crmPipelineService.canTransition(lead.status, s.status));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text variant="h2">{lead.name}</Text>
          <Text variant="caption" muted>{lead.phone}</Text>
        </View>
        {stage && <Badge variant={lead.status === "converted" ? "success" : "warning"} label={stage.label} />}
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", gap: theme.spacing.sm, flexWrap: "wrap" }}>
          {transitions.map((s) => (
            <TouchableOpacity key={s.status} onPress={() => handleTransition(s.status)}
              style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.radii.full, backgroundColor: s.color + "20" }}>
              <Text variant="caption" style={{ color: s.color }}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.sm }}>
            <Text variant="h4">Details</Text>
            <DetailRow label="Source" value={lead.source} />
            <DetailRow label="Priority" value={lead.priority} />
            <DetailRow label="Interest" value={lead.interest ?? "N/A"} />
            {lead.expected_revenue > 0 && <DetailRow label="Exp Revenue" value={`₹${lead.expected_revenue.toLocaleString()}`} />}
            <DetailRow label="Created" value={new Date(lead.created_at).toLocaleDateString("en-IN")} />
          </CardContent>
        </Card>
        <Button variant="primary" fullWidth onPress={() => router.push(`/admin/leads/add`)}>
          <TrendingUp size={18} color="#fff" /> Convert to Member
        </Button>
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
    <Text variant="body" muted>{label}</Text>
    <Text variant="body" bold>{value}</Text>
  </View>;
}
