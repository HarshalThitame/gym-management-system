import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { crmLeadService } from "@/services/crm/crm-lead-service";
import { crmPipelineService, PIPELINE_STAGES } from "@/services/crm/crm-pipeline-service";
import { crmFollowupService } from "@/services/crm/crm-followup-service";
import { crmCommunicationService } from "@/services/crm/crm-communication-service";
import { ArrowLeft, Phone, MessageSquare, Mail, Calendar, Clock, ChevronRight, Note, Plus, Activity } from "lucide-react-native";
import type { LeadExtended, LeadNote, LeadStatus } from "@/services/crm/crm-lead-service";
import type { FollowUp } from "@/services/crm/crm-followup-service";
import type { CommRecord } from "@/services/crm/crm-communication-service";

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<LeadExtended | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [communications, setCommunications] = useState<CommRecord[]>([]);
  const [newNote, setNewNote] = useState("");

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    try {
      const [l, n, f, c] = await Promise.all([
        crmLeadService.getLead(id),
        crmLeadService.getNotes(id),
        crmFollowupService.getFollowUpsForLead(id),
        crmCommunicationService.getLeadCommunications(id),
      ]);
      setLead(l);
      setNotes(n);
      setFollowups(f);
      setCommunications(c);
    } catch {} finally { setLoading(false); }
  };

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead) return;
    const result = await crmPipelineService.transitionLead(id, newStatus, profile?.id);
    if (result.ok) { load(); } else { Alert.alert("Error", result.error ?? "Transition failed"); }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !profile?.id) return;
    const ok = await crmLeadService.addNote(id, newNote.trim(), profile.id);
    if (ok) { setNewNote(""); load(); }
  };

  const handleLogCall = async () => {
    const ok = await crmCommunicationService.logCommunication({ lead_id: id, channel: "call", direction: "outbound", subject: "Phone call" });
    if (ok) load();
  };

  if (loading) return <LoadingState fullScreen />;
  if (!lead) return <Text>Lead not found</Text>;

  const stage = PIPELINE_STAGES.find((s) => s.status === lead.status);
  const availableTransitions = PIPELINE_STAGES.filter((s) => crmPipelineService.canTransition(lead.status, s.status));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text variant="h2">{lead.name}</Text>
          <Text variant="caption" muted>{lead.phone}{lead.email ? ` · ${lead.email}` : ""}</Text>
        </View>
        {stage && <Badge variant={lead.status === "converted" ? "success" : lead.status === "lost" ? "danger" : "warning"} label={stage.label} />}
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          <TouchableOpacity onPress={handleLogCall} style={{ flex: 1, padding: theme.spacing.md, backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radii.md, alignItems: "center", gap: 4 }}>
            <Phone size={20} color={theme.colors.primary} />
            <Text variant="caption" color={theme.colors.primary}>Log Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, padding: theme.spacing.md, backgroundColor: theme.colors.infoMuted, borderRadius: theme.radii.md, alignItems: "center", gap: 4 }}>
            <MessageSquare size={20} color={theme.colors.info} />
            <Text variant="caption" color={theme.colors.info}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, padding: theme.spacing.md, backgroundColor: theme.colors.warningMuted, borderRadius: theme.radii.md, alignItems: "center", gap: 4 }}>
            <Calendar size={20} color={theme.colors.warning} />
            <Text variant="caption" color={theme.colors.warning}>Schedule</Text>
          </TouchableOpacity>
        </View>

        {availableTransitions.length > 0 && (
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="caption" muted uppercase>Move to</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
              {availableTransitions.map((s) => (
                <TouchableOpacity key={s.status} onPress={() => handleStatusChange(s.status)}
                  style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.full, backgroundColor: s.color + "20" }}>
                  <Text variant="caption" style={{ color: s.color }}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.sm }}>
            <Text variant="h4">Details</Text>
            <DetailRow label="Source" value={lead.source?.replace("_", " ")} />
            <DetailRow label="Interest" value={lead.interest ?? "N/A"} />
            <DetailRow label="Priority" value={lead.priority} />
            {lead.expected_revenue > 0 && <DetailRow label="Exp. Revenue" value={`₹${lead.expected_revenue.toLocaleString()}`} />}
            <DetailRow label="Created" value={new Date(lead.created_at).toLocaleDateString("en-IN")} />
            {lead.last_contacted_at && <DetailRow label="Last Contact" value={new Date(lead.last_contacted_at).toLocaleDateString("en-IN")} />}
            {lead.message && <DetailRow label="Message" value={lead.message} />}
          </CardContent>
        </Card>

        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text variant="h4">Notes</Text>
            </View>
            <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
              <TextInput value={newNote} onChangeText={setNewNote} placeholder="Add a note..." placeholderTextColor={theme.colors.fgMuted}
                style={{ flex: 1, backgroundColor: theme.colors.bgSurface, borderRadius: theme.radii.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, color: theme.colors.fg, fontSize: 14, borderWidth: 1, borderColor: theme.colors.border }} />
              <TouchableOpacity onPress={handleAddNote} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
                <Plus size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {notes.map((note) => (
              <View key={note.id} style={{ paddingVertical: theme.spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                <Text variant="bodySmall">{note.content}</Text>
                <Text variant="caption" muted>{new Date(note.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</Text>
              </View>
            ))}
          </CardContent>
        </Card>

        {communications.length > 0 && (
          <Card variant="muted">
            <CardContent style={{ gap: theme.spacing.sm }}>
              <Text variant="h4">Communication History</Text>
              {communications.slice(0, 5).map((c) => (
                <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.xs }}>
                  {c.channel === "call" ? <Phone size={14} color={theme.colors.fgMuted} /> : <MessageSquare size={14} color={theme.colors.fgMuted} />}
                  <Text variant="bodySmall" style={{ flex: 1 }}>{c.subject ?? c.channel} ({c.direction})</Text>
                  <Text variant="caption" muted>{new Date(c.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</Text>
                </View>
              ))}
            </CardContent>
          </Card>
        )}
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
