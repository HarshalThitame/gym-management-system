import { getSupabaseClient } from "@/api/supabase";

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  read: boolean;
}

export const trainerChatService = {
  async sendMessage(senderId: string, receiverId: string, message: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("chat_messages").insert({
        sender_id: senderId,
        receiver_id: receiverId,
        message,
        created_at: new Date().toISOString(),
        read: false,
      });
      return !error;
    } catch {
      return false;
    }
  },

  async getConversation(userId1: string, userId2: string, limit = 50): Promise<ChatMessage[]> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .or(`sender_id.eq.${userId1},receiver_id.eq.${userId1}`)
      .or(`sender_id.eq.${userId2},receiver_id.eq.${userId2}`)
      .order("created_at", { ascending: false })
      .limit(limit);

    return ((data ?? []) as ChatMessage[]).reverse();
  },

  async markAsRead(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    const supabase = getSupabaseClient();
    await supabase.from("chat_messages").update({ read: true }).in("id", messageIds);
  },

  subscribeToMessages(userId: string, callback: (message: ChatMessage) => void) {
    const supabase = getSupabaseClient();
    return supabase
      .channel("chat-messages")
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload: any) => {
          callback(payload.new as ChatMessage);
        }
      )
      .subscribe();
  },
};
