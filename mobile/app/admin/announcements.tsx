import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, RefreshControl, TextInput, Alert } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { commAnnouncementService } from "@/services/communication/comm-announcements";
import { Megaphone, Plus, ChevronRight, Send } from "lucide-react-native";

export default function AnnouncementsScreen() {
  const { theme } = useTheme(); const { organizationId, profile } = useAuth();
  const [loading, setLoading] = useState(true); const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false); const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { if (!organizationId) return; setAnnouncements(await commAnnouncementService.getAnnouncements(organizationId)); } catch {} finally { setLoading(false); }
  }, [organizationId]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!title || !body || !organizationId) { Alert.alert("Validation", "Title and body required."); return; }
    setSaving(true);
    const r = await commAnnouncementService.create({ organization_id: organizationId, gym_id: null, branch_id: null, title, body, audience: "all_members", priority: "normal", status: "draft", publish_at: null, expires_at: null, created_by: profile?.id ?? null });
    if (r.ok) { setShowForm(false); setTitle(""); setBody(""); load(); Alert.alert("Created", "Announcement created. Publish to notify members."); }
    else { Alert.alert("Error", r.error ?? "Failed"); }
    setSaving(false);
  };

  const handlePublish = async (id: string) => {
    Alert.alert("Publish", "Send this announcement to all recipients?", [
      { text: "Cancel", style: "cancel" },
      { text: "Publish", onPress: async () => { await commAnnouncementService.publish(id); load(); } },
    ]);
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text variant="h2">Announcements</Text>
        <TouchableOpacity onPress={() => setShowForm(!showForm)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Plus size={22} color="#fff" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 100 }}>
        {showForm && (
          <Card variant="muted">
            <CardContent style={{ gap: theme.spacing.md }}>
              <Text variant="h4">New Announcement</Text>
              <TextInput value={title} onChangeText={setTitle} placeholder="Announcement title" placeholderTextColor={theme.colors.fgMuted}
                style={{ backgroundColor: theme.colors.bgSurface, borderRadius: theme.radii.md, padding: theme.spacing.md, color: theme.colors.fg, fontSize: 15, borderWidth: 1, borderColor: theme.colors.border }} />
              <TextInput value={body} onChangeText={setBody} placeholder="Announcement content..." placeholderTextColor={theme.colors.fgMuted} multiline numberOfLines={4}
                style={{ backgroundColor: theme.colors.bgSurface, borderRadius: theme.radii.md, padding: theme.spacing.md, color: theme.colors.fg, fontSize: 15, borderWidth: 1, borderColor: theme.colors.border, minHeight: 100, textAlignVertical: "top" }} />
              <Button variant="primary" fullWidth loading={saving} onPress={handleCreate}><Plus size={18} color="#fff" /> Create Draft</Button>
            </CardContent>
          </Card>
        )}
        {announcements.length === 0 ? <EmptyState icon={<Megaphone size={48} />} title="No announcements" description="Create announcements to notify members and staff." />
          : announcements.map((a: any) => (
            <Card key={a.id} variant="muted">
              <CardContent style={{ gap: theme.spacing.xs }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text variant="subtitle">{a.title}</Text>
                  <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
                    <Badge variant={a.status === "published" ? "success" : "warning"} label={a.status} size="sm" />
                    {a.status === "draft" && (
                      <TouchableOpacity onPress={() => handlePublish(a.id)} style={{ padding: 4, backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radii.sm }}>
                        <Send size={14} color={theme.colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text variant="bodySmall" muted numberOfLines={3}>{a.body}</Text>
                <Text variant="caption" muted>{new Date(a.created_at).toLocaleDateString("en-IN")} · {a.audience?.replace("_", " ")}</Text>
              </CardContent>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
