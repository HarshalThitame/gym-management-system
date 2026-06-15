import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, FlatList } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { memberTrainerService } from "@/services/trainer-service";
import { trainerChatService, type ChatMessage } from "@/services/trainer-chat-service";
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft, User, MessageSquare, Send, ChevronRight, Clock, CheckCircle2 } from "lucide-react-native";
import type { Trainer, TrainerSession } from "@/types";

export default function TrainerScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<TrainerSession[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadTrainer();
  }, []);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    if (showChat && trainer && profile?.id) {
      loadMessages();
      subscription = trainerChatService.subscribeToMessages(profile.id, (msg) => {
        if (flatListRef.current) {
          setMessages((prev) => [...prev, msg]);
          setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        }
      });
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
    };
  }, [showChat, trainer, profile?.id]);

  const loadTrainer = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: member } = await supabase.from("members").select("id, user_id").eq("user_id", profile?.id ?? "").maybeSingle();
      if (member) {
        const t = await memberTrainerService.getAssignedTrainer(member.id);
        setTrainer(t);
        const upcoming = await memberTrainerService.getUpcomingSessions(member.id);
        setUpcomingSessions(upcoming);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!trainer || !profile?.id) return;
    const conv = await trainerChatService.getConversation(profile.id, trainer.id);
    setMessages(conv);
  };

  const handleSend = async () => {
    if (!messageText.trim() || !trainer || !profile?.id) return;
    setSending(true);
    const text = messageText.trim();
    setMessageText("");
    setMessages((prev) => [...prev, {
      id: `optimistic-${Date.now()}`,
      sender_id: profile.id!,
      receiver_id: trainer.id,
      message: text,
      created_at: new Date().toISOString(),
      read: false,
    }]);
    await trainerChatService.sendMessage(profile.id, trainer.id, text);
    setSending(false);
  };

  if (loading) return <LoadingState fullScreen />;

  if (showChat && trainer) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
          <TouchableOpacity onPress={() => setShowChat(false)}>
            <ArrowLeft size={24} color={theme.colors.fg} />
          </TouchableOpacity>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
            <User size={18} color={theme.colors.primary} />
          </View>
          <Text variant="h4" style={{ flex: 1 }}>{trainer.display_name}</Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={<EmptyState title="No messages yet" description="Start a conversation with your trainer." />}
          renderItem={({ item }) => {
            const isMine = item.sender_id === profile?.id;
            return (
              <View style={{ alignItems: isMine ? "flex-end" : "flex-start" }}>
                <View style={{
                  maxWidth: "80%",
                  padding: theme.spacing.md,
                  borderRadius: theme.radii.lg,
                  backgroundColor: isMine ? theme.colors.primary : theme.colors.bgSurfaceMuted,
                  borderBottomRightRadius: isMine ? 4 : theme.radii.lg,
                  borderBottomLeftRadius: !isMine ? 4 : theme.radii.lg,
                }}>
                  <Text variant="body" color={isMine ? theme.colors.primaryFg : theme.colors.fg}>
                    {item.message}
                  </Text>
                  <Text variant="caption" style={{ color: isMine ? "rgba(255,255,255,0.6)" : theme.colors.fgMuted, marginTop: 4, fontSize: 10 }}>
                    {new Date(item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={{ flexDirection: "row", gap: theme.spacing.sm, padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.bg }}>
          <TextInput
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.fgMuted}
            multiline
            style={{
              flex: 1,
              backgroundColor: theme.colors.bgSurface,
              borderRadius: theme.radii.xl,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              color: theme.colors.fg,
              maxHeight: 100,
              fontSize: 15,
            }}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!messageText.trim() || sending}
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: messageText.trim() ? theme.colors.primary : theme.colors.bgSurfaceMuted,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Send size={20} color={messageText.trim() ? theme.colors.primaryFg : theme.colors.fgMuted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">My Trainer</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        {trainer ? (
          <Card variant="muted">
            <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.lg }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                <User size={32} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h3">{trainer.display_name}</Text>
                <Text variant="body" muted>{trainer.specialization ?? "Personal Trainer"}</Text>
              </View>
            </CardContent>
          </Card>
        ) : (
          <EmptyState title="No Trainer Assigned" description="Contact the front desk to get a personal trainer." />
        )}

        {trainer && (
          <Button variant="primary" size="lg" fullWidth onPress={() => setShowChat(true)}>
            <MessageSquare size={20} color={theme.colors.primaryFg} /> Message {trainer.display_name}
          </Button>
        )}

        {upcomingSessions.length > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="h4">Upcoming Sessions</Text>
            {upcomingSessions.map((session) => (
              <Card key={session.id} variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                    <Clock size={22} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="subtitle">
                      {new Date(session.session_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                    </Text>
                    <Text variant="bodySmall" muted>{session.starts_at.slice(0, 5)} - {session.ends_at.slice(0, 5)}</Text>
                  </View>
                  <Badge variant="warning" label={session.status.replace("_", " ")} size="sm" />
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
