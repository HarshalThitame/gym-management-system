import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, RefreshControl, KeyboardAvoidingView, Platform } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSupabaseClient } from "@/api/supabase";
import { MessageSquare, Send, User, ChevronRight, ArrowLeft } from "lucide-react-native";
import { trainerChatService } from "@/services/trainer-chat-service";

export default function TrainerCommunicationsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");

  useEffect(() => { loadMembers(); }, []);

  useEffect(() => {
    if (!selectedMember) return;
    loadMessages();
    const sub = trainerChatService.subscribeToMessages(profile?.id ?? "", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    return () => { try { sub?.unsubscribe(); } catch {} };
  }, [selectedMember]);

  const loadMembers = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: trainer } = await supabase.from("trainers").select("id").eq("gym_id", profile?.gym_id ?? "").maybeSingle();
      if (!trainer) return;

      const { data } = await supabase
        .from("trainer_assignments")
        .select("member_id, members!inner(id, full_name, member_code, phone)")
        .eq("trainer_id", trainer.id)
        .eq("status", "active");
      setMembers((data ?? []).map((a: any) => a.members));
    } catch {} finally { setLoading(false); }
  };

  const loadMessages = async () => {
    if (!selectedMember || !profile?.id) return;
    const conv = await trainerChatService.getConversation(profile.id, selectedMember.id);
    setMessages(conv);
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedMember || !profile?.id) return;
    const text = messageText.trim();
    setMessageText("");
    setMessages((prev) => [...prev, { id: `opt-${Date.now()}`, sender_id: profile.id, receiver_id: selectedMember.id, message: text, created_at: new Date().toISOString(), read: false }]);
    await trainerChatService.sendMessage(profile.id, selectedMember.id, text);
  };

  if (selectedMember) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md, padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
          <TouchableOpacity onPress={() => setSelectedMember(null)}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
          <User size={20} color={theme.colors.primary} />
          <Text variant="subtitle" style={{ flex: 1 }}>{selectedMember.full_name}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.sm, flex: 1 }}>
          {messages.map((msg, i) => (
            <View key={msg.id ?? i} style={{ alignItems: msg.sender_id === profile?.id ? "flex-end" : "flex-start" }}>
              <View style={{ maxWidth: "80%", padding: theme.spacing.md, borderRadius: theme.radii.lg, backgroundColor: msg.sender_id === profile?.id ? theme.colors.primary : theme.colors.bgSurfaceMuted }}>
                <Text variant="body" color={msg.sender_id === profile?.id ? "#fff" : theme.colors.fg}>{msg.message}</Text>
                <Text style={{ fontSize: 10, color: msg.sender_id === profile?.id ? "rgba(255,255,255,0.6)" : theme.colors.fgMuted, marginTop: 4 }}>
                  {new Date(msg.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: theme.spacing.sm, padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
          <TextInput value={messageText} onChangeText={setMessageText} placeholder="Type a message..." placeholderTextColor={theme.colors.fgMuted}
            style={{ flex: 1, backgroundColor: theme.colors.bgSurface, borderRadius: 20, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, color: theme.colors.fg, maxHeight: 80, fontSize: 15 }} />
          <TouchableOpacity onPress={handleSend} disabled={!messageText.trim()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: messageText.trim() ? theme.colors.primary : theme.colors.bgSurfaceMuted, alignItems: "center", justifyContent: "center" }}>
            <Send size={18} color={messageText.trim() ? "#fff" : theme.colors.fgMuted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Messages</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: 100 }}>
        {members.length === 0 ? <EmptyState icon={<MessageSquare size={48} />} title="No conversations" description="Messages with your assigned members will appear here." />
          : members.map((m) => (
            <TouchableOpacity key={m.id} activeOpacity={0.7} onPress={() => setSelectedMember(m)}>
              <Card variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                    <Text variant="subtitle" color={theme.colors.primary}>{m.full_name.charAt(0)}</Text>
                  </View>
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
