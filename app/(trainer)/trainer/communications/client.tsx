"use client";

import { useActionState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, UsersRound, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendStaffMessageAction } from "@/features/training/actions/trainer-self-service-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import type { TrainerRow } from "@/types/training";

export function StaffChatSection({
  trainers,
  currentTrainerId,
  messages = [],
}: {
  trainers: TrainerRow[];
  currentTrainerId: string;
  messages?: Array<{ id: string; senderId: string; senderName: string; recipientId: string; message: string; createdAt: string }>;
}) {
  const [state, formAction, pending] = useActionState(sendStaffMessageAction, initialAuthActionState);

  const otherTrainers = trainers.filter((t) => t.id !== currentTrainerId);

  if (otherTrainers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-muted/50 p-6 text-center">
        <UsersRound className="mx-auto size-6 text-muted-foreground/50" />
        <p className="mt-2 text-sm font-bold text-muted-foreground">No other trainers available</p>
        <p className="mt-1 text-xs text-muted-foreground">Inter-trainer messaging will be available when other trainers are added.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Recent Messages</p>
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-muted/50 p-4 text-center">
            <MessageSquare className="mx-auto size-5 text-muted-foreground/50" />
            <p className="mt-1 text-xs font-semibold text-muted-foreground">No messages yet. Send one below.</p>
          </div>
        ) : (
          <div className="max-h-60 space-y-2 overflow-y-auto">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isMine = msg.senderId === currentTrainerId;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg p-3 text-sm ${
                      isMine
                        ? "ml-6 bg-accent/10 border border-accent/20"
                        : "mr-6 bg-surface-muted border border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {isMine ? "You" : msg.senderName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <p className="mt-1 leading-5">{msg.message}</p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <form action={formAction} className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <select
              name="recipientId"
              defaultValue=""
              className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
              required
            >
              <option value="">Select a trainer...</option>
              {otherTrainers.map((t) => (
                <option key={t.id} value={t.id}>{t.display_name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <textarea
            name="message"
            rows={2}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
            required
          />
          <Button type="submit" disabled={pending} className="shrink-0 self-end">
            <Send className="mr-2 size-4" />
            {pending ? "Sending..." : "Send"}
          </Button>
        </div>
        {state?.status === "error" && (
          <p className="text-sm font-bold text-destructive animate-shake">{state.message}</p>
        )}
        {state?.status === "success" && (
          <p className="text-sm font-bold text-success">{state.message}</p>
        )}
      </form>
    </div>
  );
}
